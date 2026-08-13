import { randomUUID } from 'node:crypto'
import type { Logger } from 'pino'
import { OrderStatus } from '../../../generated/prisma/enums'
import { prisma } from '../../lib/prisma'
import { ConflictError, ForbiddenError, InvalidTransitionError, NotFoundError, ValidationError } from '../../shared/errors'
import { isUniqueViolation } from '../../shared/prisma-errors'
import { assertTransition, ORDER_TRANSITIONS } from '../../shared/state-machines'
import type { EventsRepository } from '../events/events.repository'
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
    private readonly paymentProvider: PaymentProvider,
  ) {}

  async createOrder(userId: string, dto: CreateOrderDto, idempotencyKey: string, log: Logger) {
    const event = await this.eventsRepo.findById(prisma, dto.eventId)
    if (!event) throw new NotFoundError('Evento')

    const holds = await this.holdRepo.findManyOwnedActive(prisma, dto.holdIds, dto.eventId, userId)
    if (holds.length !== dto.holdIds.length) {
      // não distingue "não é seu" de "expirou" -- ambos vazariam menos informação juntos
      throw new ConflictError('HOLD_EXPIRED', 'Um ou mais holds não estão disponíveis para este pedido')
    }

    // amountInCents é sempre calculado aqui a partir do preço do evento -- nunca do corpo
    const amountInCents = event.priceInCents * holds.length

    // I/O externo FORA da transação (§5.5.3) -- chamada HTTP dentro de tx aumenta o
    // tempo de lock e o risco de deadlock. Idempotente pela idempotencyKey: em retry,
    // o Stripe (e o FakePaymentProvider) devolvem o mesmo intent, nunca cobram 2x.
    const intent = await this.paymentProvider.createIntent({
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
        })
        await this.holdRepo.linkToOrder(tx, holds.map((h) => h.id), created.id)
        return created
      })

      log.info({ msg: 'order created', orderId: order.id, amountInCents })
      return { order, clientSecret: intent.clientSecret }
    } catch (err) {
      if (!isUniqueViolation(err)) throw err

      // clique duplo: a idempotencyKey já tem um Order -- devolve o primeiro, sem
      // criar um segundo pedido nem vincular os holds de novo
      const existing = await this.repo.findByIdempotencyKey(prisma, idempotencyKey)
      if (!existing) throw err

      log.info({ msg: 'order idempotent replay', orderId: existing.id, idempotencyKey })
      return { order: existing, clientSecret: intent.clientSecret }
    }
  }

  async getById(id: string, userId: string) {
    const order = await this.repo.findById(prisma, id)
    if (!order || order.userId !== userId) throw new NotFoundError('Order') // privado -- não revela

    return order
  }

  // Só existe com `FakePaymentProvider` ativo (§4.5, etapa 08 do front, "Dia 2") --
  // o próprio Stripe não tem como o BROWSER decidir se um pagamento foi aprovado ou
  // recusado; normalmente é o webhook que confirma. Esta rota é o substituto de
  // desenvolvimento para esse webhook, para o fluxo inteiro (criação → aprovação/
  // recusa → emissão de ingresso) fechar sem depender de credenciais reais do
  // Stripe. `outcome` usa o mesmo vocabulário de `paymentIntent.status` do Stripe --
  // o front trata os dois caminhos (fake e Stripe de verdade) da mesma forma.
  async simulatePayment(
    orderId: string,
    userId: string,
    outcome: SimulatePaymentDto['outcome'],
    log: Logger,
  ): Promise<void> {
    if (!this.paymentProvider.supportsSimulation) {
      throw new ForbiddenError('Simulação de pagamento não está disponível com o provedor de pagamento atual')
    }

    const order = await this.repo.findById(prisma, orderId)
    if (!order || order.userId !== userId) throw new NotFoundError('Order') // privado -- não revela

    if (outcome === 'succeeded') {
      await this.confirmPayment(orderId, log)
    } else {
      await this.failPayment(orderId, log)
    }
  }

  // chamado pelo Service, não pelo controller do webhook direto -- lança
  // InvalidTransitionError se a Order não estiver PENDING (§7.10.3, copiar como está)
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
          codeHash,
          qrJti: jti,
        })
      }

      await this.holdRepo.consume(tx, holds.map((h) => h.id))
      await this.seatStateRepo.markSold(tx, holds.map((h) => h.seatId))
    })

    log.info({ msg: 'order paid, tickets issued', orderId: order.id, ticketCount: holds.length })
  }

  // política (Anexo B #3): mantém o hold vivo pelo TTL restante -- não libera o
  // assento aqui. O cliente troca de cartão e tenta de novo com os mesmos holds; se
  // não tentar, o próprio TTL do hold (menor que o do pedido) resolve.
  async failPayment(orderId: string, log: Logger): Promise<void> {
    const order = await this.repo.findById(prisma, orderId)
    if (!order) throw new NotFoundError('Order')

    assertTransition(ORDER_TRANSITIONS, order.status, OrderStatus.FAILED)
    await this.repo.updateStatus(prisma, orderId, OrderStatus.FAILED)

    log.info({ msg: 'order failed', orderId })
  }

  // true = primeira vez que este evento do Stripe é visto (idempotência em duas
  // camadas, §4.5): esta é a camada 1, INSERT em ProcessedWebhookEvent
  async recordWebhookEvent(id: string, type: string): Promise<boolean> {
    try {
      await this.webhookEventRepo.create(prisma, id, type)
      return true
    } catch (err) {
      if (isUniqueViolation(err)) return false
      throw err
    }
  }

  // camada 2 da idempotência: se a Order já não está PENDING, assertTransition lança
  // InvalidTransitionError -- aqui isso é esperado e vira no-op, não erro
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
