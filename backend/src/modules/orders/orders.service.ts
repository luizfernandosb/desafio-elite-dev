import { randomUUID } from 'node:crypto'
import type { Logger } from 'pino'
import { OrderStatus, PaymentMethod, TicketStatus } from '../../../generated/prisma/enums'
import { prisma } from '../../lib/prisma'
import { ConflictError, ForbiddenError, InvalidTransitionError, NotFoundError, ValidationError } from '../../shared/errors'
import { isUniqueViolation } from '../../shared/prisma-errors'
import { assertTransition, ORDER_TRANSITIONS, TICKET_TRANSITIONS } from '../../shared/state-machines'
import type { EventsRepository } from '../events/events.repository'
import { computeEffectivePriceInCents, computeSeatPriceInCents } from '../events/pricing'
import type { SeatHoldRepository } from '../seats/seat-hold.repository'
import type { SeatStateRepository } from '../seats/seat-state.repository'
import { generateTicketCode } from '../tickets/qr.service'
import type { TicketRepository } from '../tickets/ticket.repository'
import type { OrdersRepository } from './orders.repository'
import type { CreateOrderDto, SimulatePaymentDto } from './orders.schema'
import type { PaymentProvider } from './providers/payment-provider'
import type { WebhookEventRepository } from './webhook-event.repository'

const ORDER_TTL_MS = 30 * 60 * 1000

export class OrdersService {
  constructor(
    private readonly repo: OrdersRepository,
    private readonly eventsRepo: EventsRepository,
    private readonly holdRepo: SeatHoldRepository,
    private readonly seatStateRepo: SeatStateRepository,
    private readonly ticketRepo: TicketRepository,
    private readonly webhookEventRepo: WebhookEventRepository,
    private readonly paymentProviders: Record<PaymentMethod, PaymentProvider>,
  ) {}

  private resolveProvider(method: PaymentMethod): PaymentProvider {
    return this.paymentProviders[method]
  }

  async createOrder(userId: string, dto: CreateOrderDto, idempotencyKey: string, log: Logger) {
    const event = await this.eventsRepo.findById(prisma, dto.eventId)
    if (!event) throw new NotFoundError('Evento')

    const holds = await this.holdRepo.findManyOwnedActive(prisma, dto.holdIds, dto.eventId, userId)
    if (holds.length !== dto.holdIds.length) {
      throw new ConflictError('HOLD_EXPIRED', 'Um ou mais holds não estão disponíveis para este pedido')
    }

    const effectivePriceInCents = computeEffectivePriceInCents(event)
    const amountInCents = holds.reduce(
      (sum, hold) => sum + computeSeatPriceInCents(effectivePriceInCents, hold.priceType),
      0,
    )

    const provider = this.resolveProvider(dto.paymentMethod)
    const intent = await provider.createIntent({
      amountInCents,
      currency: event.currency,
      metadata: { eventId: event.id, userId },
      idempotencyKey,
    })

    try {
      const order = await prisma.$transaction(async (tx) => {
        const created = await this.repo.create(tx, {
          userId,
          eventId: event.id,
          amountInCents,
          currency: event.currency,
          stripePaymentIntentId: intent.id,
          idempotencyKey,
          expiresAt: new Date(Date.now() + ORDER_TTL_MS),
          paymentMethod: dto.paymentMethod,
        })
        await this.holdRepo.linkToOrder(tx, holds.map((h) => h.id), created.id)
        return created
      })

      log.info({ msg: 'order created', orderId: order.id, amountInCents })
      return { order, clientSecret: intent.clientSecret }
    } catch (err) {
      if (!isUniqueViolation(err)) throw err

      const existing = await this.repo.findByIdempotencyKey(prisma, idempotencyKey)
      if (!existing) throw err

      log.info({ msg: 'order idempotent replay', orderId: existing.id, idempotencyKey })
      return { order: existing, clientSecret: intent.clientSecret }
    }
  }

  async getById(id: string, userId: string) {
    const order = await this.repo.findById(prisma, id)
    if (!order || order.userId !== userId) throw new NotFoundError('Order')

    return order
  }

  async simulatePayment(
    orderId: string,
    userId: string,
    outcome: SimulatePaymentDto['outcome'],
    log: Logger,
  ): Promise<void> {
    const order = await this.repo.findById(prisma, orderId)
    if (!order || order.userId !== userId) throw new NotFoundError('Order')

    if (!this.resolveProvider(order.paymentMethod).supportsSimulation) {
      throw new ForbiddenError('Simulação de pagamento não está disponível com o provedor de pagamento atual')
    }

    if (outcome === 'succeeded') {
      await this.confirmPayment(orderId, log)
    } else {
      await this.failPayment(orderId, log)
    }
  }

  async confirmPayment(orderId: string, log: Logger): Promise<void> {
    const order = await this.repo.findById(prisma, orderId)
    if (!order) throw new NotFoundError('Order')

    assertTransition(ORDER_TRANSITIONS, order.status, OrderStatus.PAID)

    const holds = await this.holdRepo.findByOrderId(prisma, order.id)
    if (holds.length === 0) {
      throw new ValidationError('Order sem holds vinculados -- não há o que emitir')
    }

    await prisma.$transaction(async (tx) => {
      await this.repo.updateStatus(tx, order.id, OrderStatus.PAID)

      for (const hold of holds) {
        if (!hold.seatId) continue
        const ticketId = randomUUID()
        const { codeHash, jti } = generateTicketCode({ ticketId, eventId: order.eventId })
        await this.ticketRepo.create(tx, {
          id: ticketId,
          orderId: order.id,
          eventId: order.eventId,
          seatId: hold.seatId,
          priceType: hold.priceType,
          codeHash,
          qrJti: jti,
        })
      }

      await this.holdRepo.consume(tx, holds.map((h) => h.id))
      await this.seatStateRepo.markSold(tx, holds.map((h) => h.seatId))
    })

    log.info({ msg: 'order paid, tickets issued', orderId: order.id, ticketCount: holds.length })
  }

  async failPayment(orderId: string, log: Logger): Promise<void> {
    const order = await this.repo.findById(prisma, orderId)
    if (!order) throw new NotFoundError('Order')

    assertTransition(ORDER_TRANSITIONS, order.status, OrderStatus.FAILED)
    await this.repo.updateStatus(prisma, orderId, OrderStatus.FAILED)

    log.info({ msg: 'order failed', orderId })
  }

  async cancelTicket(ticketId: string, userId: string, log: Logger) {
    const ticket = await this.ticketRepo.findOwnedById(prisma, ticketId, userId)
    if (!ticket) throw new NotFoundError('Ingresso')

    assertTransition(TICKET_TRANSITIONS, ticket.status, TicketStatus.CANCELLED)

    const event = await this.eventsRepo.findById(prisma, ticket.eventId)
    if (!event) throw new NotFoundError('Evento')
    if (event.startsAt.getTime() <= Date.now()) {
      throw new ConflictError('EVENT_ALREADY_STARTED', 'Não é possível cancelar depois que a sessão começou')
    }

    const order = await this.repo.findById(prisma, ticket.orderId)
    if (!order) throw new NotFoundError('Order')

    const effectivePriceInCents = computeEffectivePriceInCents(event)
    const refundAmountInCents = computeSeatPriceInCents(effectivePriceInCents, ticket.priceType)

    const remainingActive = await prisma.$transaction(async (tx) => {
      await this.ticketRepo.updateStatus(tx, ticket.id, TicketStatus.CANCELLED)
      await this.seatStateRepo.markFree(tx, [ticket.seatId as string])

      const remaining = await this.ticketRepo.countActiveByOrderId(tx, order.id)
      if (remaining === 0) {
        assertTransition(ORDER_TRANSITIONS, order.status, OrderStatus.REFUNDED)
        await this.repo.updateStatus(tx, order.id, OrderStatus.REFUNDED)
      }
      return remaining
    })

    if (order.stripePaymentIntentId) {
      try {
        await this.resolveProvider(order.paymentMethod).refund(order.stripePaymentIntentId, refundAmountInCents)
      } catch (err) {
        log.error({ msg: 'refund falhou após cancelamento já commitado', orderId: order.id, ticketId: ticket.id, err })
      }
    }

    log.info({
      msg: 'ticket cancelado, assento devolvido ao estoque',
      ticketId: ticket.id,
      seatId: ticket.seatId,
      orderFullyRefunded: remainingActive === 0,
    })

    return this.ticketRepo.findOwnedById(prisma, ticket.id, userId)
  }

  async recordWebhookEvent(id: string, type: string): Promise<boolean> {
    try {
      await this.webhookEventRepo.create(prisma, id, type)
      return true
    } catch (err) {
      if (isUniqueViolation(err)) return false
      throw err
    }
  }

  async handleWebhookPaymentSucceeded(paymentIntentId: string, log: Logger): Promise<void> {
    const order = await this.repo.findByPaymentIntentId(prisma, paymentIntentId)
    if (!order) throw new NotFoundError('Order')

    try {
      await this.confirmPayment(order.id, log)
    } catch (err) {
      if (err instanceof InvalidTransitionError) {
        log.info({ msg: 'payment_intent.succeeded em order já processada -- no-op', orderId: order.id })
        return
      }
      throw err
    }
  }

  async handleWebhookPaymentFailed(paymentIntentId: string, log: Logger): Promise<void> {
    const order = await this.repo.findByPaymentIntentId(prisma, paymentIntentId)
    if (!order) throw new NotFoundError('Order')

    try {
      await this.failPayment(order.id, log)
    } catch (err) {
      if (err instanceof InvalidTransitionError) {
        log.info({ msg: 'payment_intent.payment_failed em order já processada -- no-op', orderId: order.id })
        return
      }
      throw err
    }
  }
}
