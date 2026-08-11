import type { Logger } from 'pino'
import { describe, expect, it, vi } from 'vitest'
import { EventStatus, OrderStatus } from '../../../generated/prisma/enums'
import { InvalidTransitionError, NotFoundError } from '../../shared/errors'
import type { EventsRepository } from '../events/events.repository'
import type { SeatHoldRepository } from '../seats/seat-hold.repository'
import type { SeatStateRepository } from '../seats/seat-state.repository'
import type { TicketRepository } from '../tickets/ticket.repository'
import type { OrdersRepository } from './orders.repository'
import { OrdersService } from './orders.service'
import type { PaymentProvider } from './providers/payment-provider'
import type { WebhookEventRepository } from './webhook-event.repository'

vi.mock('../../lib/prisma', () => ({
  prisma: { $transaction: (callback: (tx: string) => unknown) => callback('fake-tx') },
}))

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as Logger

function makeOrder(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'order-1',
    userId: 'user-1',
    eventId: 'event-1',
    status: OrderStatus.PENDING,
    amountInCents: 18000,
    currency: 'BRL',
    stripePaymentIntentId: 'pi_test_123',
    ...overrides,
  }
}

function makeMockOrdersRepo(): OrdersRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByIdempotencyKey: vi.fn(),
    findByPaymentIntentId: vi.fn(),
    updateStatus: vi.fn(),
  } as unknown as OrdersRepository
}

function makeMockEventsRepo(): EventsRepository {
  return {
    findById: vi.fn().mockResolvedValue({
      id: 'event-1',
      status: EventStatus.PUBLISHED,
      priceInCents: 6000,
      currency: 'BRL',
    }),
  } as unknown as EventsRepository
}

function makeMockHoldRepo(): SeatHoldRepository {
  return {
    findManyOwnedActive: vi.fn(),
    linkToOrder: vi.fn(),
    findByOrderId: vi.fn().mockResolvedValue([]),
    consume: vi.fn(),
  } as unknown as SeatHoldRepository
}

function makeMockSeatStateRepo(): SeatStateRepository {
  return { markSold: vi.fn() } as unknown as SeatStateRepository
}

function makeMockTicketRepo(): TicketRepository {
  return { create: vi.fn() } as unknown as TicketRepository
}

function makeMockWebhookEventRepo(): WebhookEventRepository {
  return { create: vi.fn() } as unknown as WebhookEventRepository
}

function makeMockPaymentProvider(): PaymentProvider {
  return {
    createIntent: vi.fn().mockResolvedValue({ id: 'pi_test_123', clientSecret: 'secret_123' }),
    refund: vi.fn(),
  }
}

function makeService(overrides: {
  ordersRepo?: OrdersRepository
  holdRepo?: SeatHoldRepository
} = {}) {
  return new OrdersService(
    overrides.ordersRepo ?? makeMockOrdersRepo(),
    makeMockEventsRepo(),
    overrides.holdRepo ?? makeMockHoldRepo(),
    makeMockSeatStateRepo(),
    makeMockTicketRepo(),
    makeMockWebhookEventRepo(),
    makeMockPaymentProvider(),
  )
}

describe('OrdersService.createOrder', () => {
  it('calcula amountInCents = preço do evento × nº de holds, ignorando qualquer valor do corpo', async () => {
    const holdRepo = makeMockHoldRepo()
    vi.mocked(holdRepo.findManyOwnedActive).mockResolvedValue([
      { id: 'hold-1', seatId: 'seat-1' },
      { id: 'hold-2', seatId: 'seat-2' },
    ] as never)
    const ordersRepo = makeMockOrdersRepo()
    vi.mocked(ordersRepo.create).mockResolvedValue(makeOrder({ amountInCents: 12000 }) as never)

    const service = makeService({ ordersRepo, holdRepo })
    // dto não tem campo de valor -- não há como "forjar" nada aqui
    await service.createOrder('user-1', { eventId: 'event-1', holdIds: ['hold-1', 'hold-2'] }, 'idem-1', log)

    expect(ordersRepo.create).toHaveBeenCalledWith(
      'fake-tx',
      expect.objectContaining({ amountInCents: 12000 }), // 6000 x 2
    )
  })

  it('409 HOLD_EXPIRED -- algum hold não está ativo/não é do usuário/não é do evento', async () => {
    const holdRepo = makeMockHoldRepo()
    vi.mocked(holdRepo.findManyOwnedActive).mockResolvedValue([{ id: 'hold-1', seatId: 'seat-1' }] as never)

    const service = makeService({ holdRepo })
    await expect(
      service.createOrder('user-1', { eventId: 'event-1', holdIds: ['hold-1', 'hold-2'] }, 'idem-1', log),
    ).rejects.toThrow('Um ou mais holds não estão disponíveis')
  })
})

describe('OrdersService.confirmPayment', () => {
  it('PENDING → PAID chama updateStatus', async () => {
    const ordersRepo = makeMockOrdersRepo()
    vi.mocked(ordersRepo.findById).mockResolvedValue(makeOrder({ status: OrderStatus.PENDING }) as never)
    const holdRepo = makeMockHoldRepo()
    vi.mocked(holdRepo.findByOrderId).mockResolvedValue([{ id: 'hold-1', seatId: 'seat-1' }] as never)

    const service = makeService({ ordersRepo, holdRepo })
    await service.confirmPayment('order-1', log)

    expect(ordersRepo.updateStatus).toHaveBeenCalledWith('fake-tx', 'order-1', OrderStatus.PAID)
  })

  it('PAID → PAID lança InvalidTransitionError e não chama updateStatus', async () => {
    const ordersRepo = makeMockOrdersRepo()
    vi.mocked(ordersRepo.findById).mockResolvedValue(makeOrder({ status: OrderStatus.PAID }) as never)

    const service = makeService({ ordersRepo })
    await expect(service.confirmPayment('order-1', log)).rejects.toThrow(InvalidTransitionError)
    expect(ordersRepo.updateStatus).not.toHaveBeenCalled()
  })

  it('EXPIRED → PAID lança InvalidTransitionError', async () => {
    const ordersRepo = makeMockOrdersRepo()
    vi.mocked(ordersRepo.findById).mockResolvedValue(makeOrder({ status: OrderStatus.EXPIRED }) as never)

    const service = makeService({ ordersRepo })
    await expect(service.confirmPayment('order-1', log)).rejects.toThrow(InvalidTransitionError)
  })

  it('emite um ticket por hold vinculado à order', async () => {
    const ordersRepo = makeMockOrdersRepo()
    vi.mocked(ordersRepo.findById).mockResolvedValue(makeOrder({ status: OrderStatus.PENDING }) as never)
    const holdRepo = makeMockHoldRepo()
    vi.mocked(holdRepo.findByOrderId).mockResolvedValue([
      { id: 'hold-1', seatId: 'seat-1' },
      { id: 'hold-2', seatId: 'seat-2' },
    ] as never)
    const ticketRepo = makeMockTicketRepo()

    const service = new OrdersService(
      ordersRepo,
      makeMockEventsRepo(),
      holdRepo,
      makeMockSeatStateRepo(),
      ticketRepo,
      makeMockWebhookEventRepo(),
      makeMockPaymentProvider(),
    )
    await service.confirmPayment('order-1', log)

    expect(ticketRepo.create).toHaveBeenCalledTimes(2)
    expect(holdRepo.consume).toHaveBeenCalledWith('fake-tx', ['hold-1', 'hold-2'])
  })
})

describe('OrdersService.failPayment', () => {
  it('transita PENDING → FAILED e preserva o hold (não libera o assento)', async () => {
    const ordersRepo = makeMockOrdersRepo()
    vi.mocked(ordersRepo.findById).mockResolvedValue(makeOrder({ status: OrderStatus.PENDING }) as never)
    const holdRepo = makeMockHoldRepo()

    const service = makeService({ ordersRepo, holdRepo })
    await service.failPayment('order-1', log)

    expect(ordersRepo.updateStatus).toHaveBeenCalledWith(expect.anything(), 'order-1', OrderStatus.FAILED)
    expect(holdRepo.consume).not.toHaveBeenCalled()
  })
})

describe('OrdersService.handleWebhookPaymentSucceeded/Failed -- idempotência de graça', () => {
  it('succeeded numa order já PAID não lança -- vira no-op', async () => {
    const ordersRepo = makeMockOrdersRepo()
    vi.mocked(ordersRepo.findByPaymentIntentId).mockResolvedValue(makeOrder({ status: OrderStatus.PAID }) as never)
    vi.mocked(ordersRepo.findById).mockResolvedValue(makeOrder({ status: OrderStatus.PAID }) as never)

    const service = makeService({ ordersRepo })
    await expect(service.handleWebhookPaymentSucceeded('pi_test_123', log)).resolves.toBeUndefined()
    expect(ordersRepo.updateStatus).not.toHaveBeenCalled()
  })

  it('404 -- nenhuma order para esse paymentIntentId (falha permanente)', async () => {
    const ordersRepo = makeMockOrdersRepo()
    vi.mocked(ordersRepo.findByPaymentIntentId).mockResolvedValue(null)

    const service = makeService({ ordersRepo })
    await expect(service.handleWebhookPaymentSucceeded('pi_inexistente', log)).rejects.toThrow(NotFoundError)
  })
})

describe('OrdersService.recordWebhookEvent', () => {
  it('true na primeira vez, false se o evento já foi registrado (P2002)', async () => {
    const webhookEventRepo = makeMockWebhookEventRepo()
    const service = new OrdersService(
      makeMockOrdersRepo(),
      makeMockEventsRepo(),
      makeMockHoldRepo(),
      makeMockSeatStateRepo(),
      makeMockTicketRepo(),
      webhookEventRepo,
      makeMockPaymentProvider(),
    )

    expect(await service.recordWebhookEvent('evt_1', 'payment_intent.succeeded')).toBe(true)
  })
})
