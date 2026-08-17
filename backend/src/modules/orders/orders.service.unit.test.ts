import type { Logger } from 'pino'
import { describe, expect, it, vi } from 'vitest'
import { EventStatus, OrderStatus, PaymentMethod, RoomType, TicketStatus } from '../../../generated/prisma/enums'
import { ConflictError, ForbiddenError, InvalidTransitionError, NotFoundError } from '../../shared/errors'
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
    paymentMethod: PaymentMethod.FAKE,
    ...overrides,
  }
}

function makeTicket(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'ticket-1',
    orderId: 'order-1',
    eventId: 'event-1',
    seatId: 'seat-1',
    priceType: 'FULL',
    status: TicketStatus.ACTIVE,
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
  return { markSold: vi.fn(), markFree: vi.fn() } as unknown as SeatStateRepository
}

function makeMockTicketRepo(): TicketRepository {
  return {
    create: vi.fn(),
    findOwnedById: vi.fn(),
    updateStatus: vi.fn(),
    countActiveByOrderId: vi.fn().mockResolvedValue(0),
  } as unknown as TicketRepository
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

// `supportsSimulation` presente -- só o `FakePaymentProvider` de verdade tem essa
// propriedade (payment-provider.ts); um mock "tipo Stripe" (acima) não tem.
function makeMockFakePaymentProvider(): PaymentProvider {
  return { ...makeMockPaymentProvider(), supportsSimulation: true }
}

function makeService(overrides: {
  ordersRepo?: OrdersRepository
  eventsRepo?: EventsRepository
  holdRepo?: SeatHoldRepository
  paymentProviders?: Partial<Record<PaymentMethod, PaymentProvider>>
} = {}) {
  return new OrdersService(
    overrides.ordersRepo ?? makeMockOrdersRepo(),
    overrides.eventsRepo ?? makeMockEventsRepo(),
    overrides.holdRepo ?? makeMockHoldRepo(),
    makeMockSeatStateRepo(),
    makeMockTicketRepo(),
    makeMockWebhookEventRepo(),
    {
      FAKE: makeMockFakePaymentProvider(),
      STRIPE: makeMockPaymentProvider(),
      ...overrides.paymentProviders,
    },
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
    await service.createOrder('user-1', { eventId: 'event-1', holdIds: ['hold-1', 'hold-2'], paymentMethod: PaymentMethod.FAKE }, 'idem-1', log)

    expect(ordersRepo.create).toHaveBeenCalledWith(
      'fake-tx',
      expect.objectContaining({ amountInCents: 12000 }), // 6000 x 2
    )
  })

  it('sessão Sala VIP -- amountInCents usa o preço com o adicional percentual, não o preço base', async () => {
    const holdRepo = makeMockHoldRepo()
    vi.mocked(holdRepo.findManyOwnedActive).mockResolvedValue([
      { id: 'hold-1', seatId: 'seat-1' },
      { id: 'hold-2', seatId: 'seat-2' },
    ] as never)
    const ordersRepo = makeMockOrdersRepo()
    vi.mocked(ordersRepo.create).mockResolvedValue(makeOrder({ amountInCents: 14400 }) as never)
    const eventsRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'event-1',
        status: EventStatus.PUBLISHED,
        priceInCents: 6000,
        currency: 'BRL',
        roomType: RoomType.VIP,
        vipSurchargePercent: 20,
      }),
    } as unknown as EventsRepository

    const service = makeService({ ordersRepo, eventsRepo, holdRepo })
    await service.createOrder('user-1', { eventId: 'event-1', holdIds: ['hold-1', 'hold-2'], paymentMethod: PaymentMethod.FAKE }, 'idem-1', log)

    // 6000 + 20% = 7200 por assento x 2 = 14400 (não 12000, que seria o preço base)
    expect(ordersRepo.create).toHaveBeenCalledWith('fake-tx', expect.objectContaining({ amountInCents: 14400 }))
  })

  it('meia-entrada -- amountInCents soma por hold, não efetivo x quantidade', async () => {
    const holdRepo = makeMockHoldRepo()
    vi.mocked(holdRepo.findManyOwnedActive).mockResolvedValue([
      { id: 'hold-1', seatId: 'seat-1', priceType: 'FULL' },
      { id: 'hold-2', seatId: 'seat-2', priceType: 'HALF' },
    ] as never)
    const ordersRepo = makeMockOrdersRepo()
    vi.mocked(ordersRepo.create).mockResolvedValue(makeOrder({ amountInCents: 9000 }) as never)

    const service = makeService({ ordersRepo, holdRepo })
    await service.createOrder('user-1', { eventId: 'event-1', holdIds: ['hold-1', 'hold-2'], paymentMethod: PaymentMethod.FAKE }, 'idem-1', log)

    // 6000 (FULL) + 3000 (HALF, metade de 6000) = 9000 -- nunca 6000 x 2 = 12000
    expect(ordersRepo.create).toHaveBeenCalledWith('fake-tx', expect.objectContaining({ amountInCents: 9000 }))
  })

  it('409 HOLD_EXPIRED -- algum hold não está ativo/não é do usuário/não é do evento', async () => {
    const holdRepo = makeMockHoldRepo()
    vi.mocked(holdRepo.findManyOwnedActive).mockResolvedValue([{ id: 'hold-1', seatId: 'seat-1' }] as never)

    const service = makeService({ holdRepo })
    await expect(
      service.createOrder('user-1', { eventId: 'event-1', holdIds: ['hold-1', 'hold-2'], paymentMethod: PaymentMethod.FAKE }, 'idem-1', log),
    ).rejects.toThrow('Um ou mais holds não estão disponíveis')
  })

  // flag de teste do checkout (front) -- paymentMethod: STRIPE usa o provedor Stripe
  // pra criar o intent, nunca o fake, e grava esse método na order (§ resolveProvider)
  it('paymentMethod STRIPE -- usa o provedor Stripe (não o fake) e grava paymentMethod na order', async () => {
    const holdRepo = makeMockHoldRepo()
    vi.mocked(holdRepo.findManyOwnedActive).mockResolvedValue([{ id: 'hold-1', seatId: 'seat-1' }] as never)
    const ordersRepo = makeMockOrdersRepo()
    vi.mocked(ordersRepo.create).mockResolvedValue(makeOrder({ paymentMethod: PaymentMethod.STRIPE }) as never)

    const fakeProvider = makeMockFakePaymentProvider()
    const stripeProvider = makeMockPaymentProvider()
    const service = makeService({ ordersRepo, holdRepo, paymentProviders: { FAKE: fakeProvider, STRIPE: stripeProvider } })

    await service.createOrder(
      'user-1',
      { eventId: 'event-1', holdIds: ['hold-1'], paymentMethod: PaymentMethod.STRIPE },
      'idem-1',
      log,
    )

    expect(stripeProvider.createIntent).toHaveBeenCalled()
    expect(fakeProvider.createIntent).not.toHaveBeenCalled()
    expect(ordersRepo.create).toHaveBeenCalledWith(
      'fake-tx',
      expect.objectContaining({ paymentMethod: PaymentMethod.STRIPE }),
    )
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
      { id: 'hold-1', seatId: 'seat-1', priceType: 'FULL' },
      { id: 'hold-2', seatId: 'seat-2', priceType: 'HALF' },
    ] as never)
    const ticketRepo = makeMockTicketRepo()

    const service = new OrdersService(
      ordersRepo,
      makeMockEventsRepo(),
      holdRepo,
      makeMockSeatStateRepo(),
      ticketRepo,
      makeMockWebhookEventRepo(),
      { FAKE: makeMockPaymentProvider(), STRIPE: makeMockPaymentProvider() },
    )
    await service.confirmPayment('order-1', log)

    expect(ticketRepo.create).toHaveBeenCalledTimes(2)
    expect(holdRepo.consume).toHaveBeenCalledWith('fake-tx', ['hold-1', 'hold-2'])
  })

  it('copia o priceType do hold para o ticket emitido -- histórico do que foi comprado', async () => {
    const ordersRepo = makeMockOrdersRepo()
    vi.mocked(ordersRepo.findById).mockResolvedValue(makeOrder({ status: OrderStatus.PENDING }) as never)
    const holdRepo = makeMockHoldRepo()
    vi.mocked(holdRepo.findByOrderId).mockResolvedValue([
      { id: 'hold-1', seatId: 'seat-1', priceType: 'HALF' },
    ] as never)
    const ticketRepo = makeMockTicketRepo()

    const service = new OrdersService(
      ordersRepo,
      makeMockEventsRepo(),
      holdRepo,
      makeMockSeatStateRepo(),
      ticketRepo,
      makeMockWebhookEventRepo(),
      { FAKE: makeMockPaymentProvider(), STRIPE: makeMockPaymentProvider() },
    )
    await service.confirmPayment('order-1', log)

    expect(ticketRepo.create).toHaveBeenCalledWith('fake-tx', expect.objectContaining({ priceType: 'HALF' }))
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

describe('OrdersService.cancelTicket', () => {
  function makeEventsRepoWithStartsAt(startsAt: Date, overrides: Partial<Record<string, unknown>> = {}) {
    return {
      findById: vi.fn().mockResolvedValue({
        id: 'event-1',
        status: EventStatus.PUBLISHED,
        priceInCents: 6000,
        currency: 'BRL',
        roomType: RoomType.STANDARD,
        vipSurchargePercent: null,
        startsAt,
        ...overrides,
      }),
    } as unknown as EventsRepository
  }

  const futureEventsRepo = () => makeEventsRepoWithStartsAt(new Date(Date.now() + 24 * 60 * 60 * 1000))

  it('ACTIVE + evento futuro -- cancela o ticket, libera o assento e reembolsa só o valor do assento', async () => {
    const ticketRepo = makeMockTicketRepo()
    vi.mocked(ticketRepo.findOwnedById).mockResolvedValue(makeTicket() as never)
    vi.mocked(ticketRepo.countActiveByOrderId).mockResolvedValue(1) // sobra outro ticket ativo no pedido

    const ordersRepo = makeMockOrdersRepo()
    vi.mocked(ordersRepo.findById).mockResolvedValue(makeOrder({ status: OrderStatus.PAID }) as never)

    const seatStateRepo = makeMockSeatStateRepo()
    const paymentProvider = makeMockPaymentProvider()

    const service = new OrdersService(
      ordersRepo,
      futureEventsRepo(),
      makeMockHoldRepo(),
      seatStateRepo,
      ticketRepo,
      makeMockWebhookEventRepo(),
      { FAKE: paymentProvider, STRIPE: makeMockPaymentProvider() },
    )
    await service.cancelTicket('ticket-1', 'user-1', log)

    expect(ticketRepo.updateStatus).toHaveBeenCalledWith('fake-tx', 'ticket-1', TicketStatus.CANCELLED)
    expect(seatStateRepo.markFree).toHaveBeenCalledWith('fake-tx', ['seat-1'])
    expect(paymentProvider.refund).toHaveBeenCalledWith('pi_test_123', 6000) // FULL, sem Sala VIP
    // ainda sobra 1 ticket ativo no pedido -- Order continua PAID, não vira REFUNDED
    expect(ordersRepo.updateStatus).not.toHaveBeenCalled()
  })

  // order criada com paymentMethod STRIPE -- reembolso tem que ir pro provedor Stripe,
  // nunca pro fake, mesmo que o fake também esteja configurado no mapa (§ resolveProvider)
  it('order com paymentMethod STRIPE -- reembolsa pelo provedor Stripe, não pelo fake', async () => {
    const ticketRepo = makeMockTicketRepo()
    vi.mocked(ticketRepo.findOwnedById).mockResolvedValue(makeTicket() as never)
    vi.mocked(ticketRepo.countActiveByOrderId).mockResolvedValue(1)

    const ordersRepo = makeMockOrdersRepo()
    vi.mocked(ordersRepo.findById).mockResolvedValue(
      makeOrder({ status: OrderStatus.PAID, paymentMethod: PaymentMethod.STRIPE }) as never,
    )

    const fakeProvider = makeMockPaymentProvider()
    const stripeProvider = makeMockPaymentProvider()

    const service = new OrdersService(
      ordersRepo,
      futureEventsRepo(),
      makeMockHoldRepo(),
      makeMockSeatStateRepo(),
      ticketRepo,
      makeMockWebhookEventRepo(),
      { FAKE: fakeProvider, STRIPE: stripeProvider },
    )
    await service.cancelTicket('ticket-1', 'user-1', log)

    expect(stripeProvider.refund).toHaveBeenCalledWith('pi_test_123', 6000)
    expect(fakeProvider.refund).not.toHaveBeenCalled()
  })

  it('último ticket ativo do pedido -- Order transita para REFUNDED', async () => {
    const ticketRepo = makeMockTicketRepo()
    vi.mocked(ticketRepo.findOwnedById).mockResolvedValue(makeTicket() as never)
    vi.mocked(ticketRepo.countActiveByOrderId).mockResolvedValue(0)

    const ordersRepo = makeMockOrdersRepo()
    vi.mocked(ordersRepo.findById).mockResolvedValue(makeOrder({ status: OrderStatus.PAID }) as never)

    const service = new OrdersService(
      ordersRepo,
      futureEventsRepo(),
      makeMockHoldRepo(),
      makeMockSeatStateRepo(),
      ticketRepo,
      makeMockWebhookEventRepo(),
      { FAKE: makeMockPaymentProvider(), STRIPE: makeMockPaymentProvider() },
    )
    await service.cancelTicket('ticket-1', 'user-1', log)

    expect(ordersRepo.updateStatus).toHaveBeenCalledWith('fake-tx', 'order-1', OrderStatus.REFUNDED)
  })

  it('meia-entrada -- reembolsa metade do preço efetivo, não o preço cheio', async () => {
    const ticketRepo = makeMockTicketRepo()
    vi.mocked(ticketRepo.findOwnedById).mockResolvedValue(makeTicket({ priceType: 'HALF' }) as never)

    const ordersRepo = makeMockOrdersRepo()
    vi.mocked(ordersRepo.findById).mockResolvedValue(makeOrder({ status: OrderStatus.PAID }) as never)
    const paymentProvider = makeMockPaymentProvider()

    const service = new OrdersService(
      ordersRepo,
      futureEventsRepo(),
      makeMockHoldRepo(),
      makeMockSeatStateRepo(),
      ticketRepo,
      makeMockWebhookEventRepo(),
      { FAKE: paymentProvider, STRIPE: makeMockPaymentProvider() },
    )
    await service.cancelTicket('ticket-1', 'user-1', log)

    expect(paymentProvider.refund).toHaveBeenCalledWith('pi_test_123', 3000) // metade de 6000
  })

  it('ticket já USED -- lança InvalidTransitionError, não toca em nada', async () => {
    const ticketRepo = makeMockTicketRepo()
    vi.mocked(ticketRepo.findOwnedById).mockResolvedValue(makeTicket({ status: TicketStatus.USED }) as never)

    const service = new OrdersService(
      makeMockOrdersRepo(),
      futureEventsRepo(),
      makeMockHoldRepo(),
      makeMockSeatStateRepo(),
      ticketRepo,
      makeMockWebhookEventRepo(),
      { FAKE: makeMockPaymentProvider(), STRIPE: makeMockPaymentProvider() },
    )

    await expect(service.cancelTicket('ticket-1', 'user-1', log)).rejects.toThrow(InvalidTransitionError)
    expect(ticketRepo.updateStatus).not.toHaveBeenCalled()
  })

  it('ticket já CANCELLED -- lança InvalidTransitionError (não é no-op silencioso)', async () => {
    const ticketRepo = makeMockTicketRepo()
    vi.mocked(ticketRepo.findOwnedById).mockResolvedValue(makeTicket({ status: TicketStatus.CANCELLED }) as never)

    const service = new OrdersService(
      makeMockOrdersRepo(),
      futureEventsRepo(),
      makeMockHoldRepo(),
      makeMockSeatStateRepo(),
      ticketRepo,
      makeMockWebhookEventRepo(),
      { FAKE: makeMockPaymentProvider(), STRIPE: makeMockPaymentProvider() },
    )

    await expect(service.cancelTicket('ticket-1', 'user-1', log)).rejects.toThrow(InvalidTransitionError)
  })

  it('evento já começou -- lança ConflictError EVENT_ALREADY_STARTED, não toca em nada', async () => {
    const ticketRepo = makeMockTicketRepo()
    vi.mocked(ticketRepo.findOwnedById).mockResolvedValue(makeTicket() as never)
    const pastEventsRepo = makeEventsRepoWithStartsAt(new Date(Date.now() - 60 * 60 * 1000))

    const service = new OrdersService(
      makeMockOrdersRepo(),
      pastEventsRepo,
      makeMockHoldRepo(),
      makeMockSeatStateRepo(),
      ticketRepo,
      makeMockWebhookEventRepo(),
      { FAKE: makeMockPaymentProvider(), STRIPE: makeMockPaymentProvider() },
    )

    const err: unknown = await service.cancelTicket('ticket-1', 'user-1', log).catch((e) => e)
    expect(err).toBeInstanceOf(ConflictError)
    expect((err as ConflictError).code).toBe('EVENT_ALREADY_STARTED')
    expect(ticketRepo.updateStatus).not.toHaveBeenCalled()
  })

  it('404 -- ticket de outro usuário ou inexistente (findOwnedById devolve null, não revela qual)', async () => {
    const ticketRepo = makeMockTicketRepo()
    vi.mocked(ticketRepo.findOwnedById).mockResolvedValue(null as never)

    const service = new OrdersService(
      makeMockOrdersRepo(),
      futureEventsRepo(),
      makeMockHoldRepo(),
      makeMockSeatStateRepo(),
      ticketRepo,
      makeMockWebhookEventRepo(),
      { FAKE: makeMockPaymentProvider(), STRIPE: makeMockPaymentProvider() },
    )

    await expect(service.cancelTicket('ticket-1', 'user-1', log)).rejects.toThrow(NotFoundError)
  })

  it('refund falha depois do commit -- loga o erro mas não reverte o cancelamento já gravado', async () => {
    const ticketRepo = makeMockTicketRepo()
    vi.mocked(ticketRepo.findOwnedById).mockResolvedValue(makeTicket() as never)
    const ordersRepo = makeMockOrdersRepo()
    vi.mocked(ordersRepo.findById).mockResolvedValue(makeOrder({ status: OrderStatus.PAID }) as never)
    const paymentProvider = makeMockPaymentProvider()
    vi.mocked(paymentProvider.refund).mockRejectedValue(new Error('Stripe fora do ar'))

    const service = new OrdersService(
      ordersRepo,
      futureEventsRepo(),
      makeMockHoldRepo(),
      makeMockSeatStateRepo(),
      ticketRepo,
      makeMockWebhookEventRepo(),
      { FAKE: paymentProvider, STRIPE: makeMockPaymentProvider() },
    )

    await expect(service.cancelTicket('ticket-1', 'user-1', log)).resolves.toBeDefined()
    expect(ticketRepo.updateStatus).toHaveBeenCalledWith('fake-tx', 'ticket-1', TicketStatus.CANCELLED)
    expect(log.error).toHaveBeenCalled()
  })
})

describe('OrdersService.simulatePayment', () => {
  // capability check é por ORDER (paymentMethod gravado na criação), não mais pelo
  // processo inteiro -- precisa carregar a order primeiro pra saber qual provedor ela
  // usou, diferente de antes (quando só existia um provedor pro processo todo e dava
  // pra rejeitar sem nem tocar o banco).
  it('order com paymentMethod STRIPE -- lança ForbiddenError, nunca atualiza status', async () => {
    const ordersRepo = makeMockOrdersRepo()
    vi.mocked(ordersRepo.findById).mockResolvedValue(makeOrder({ paymentMethod: PaymentMethod.STRIPE }) as never)
    const service = makeService({ ordersRepo })

    await expect(service.simulatePayment('order-1', 'user-1', 'succeeded', log)).rejects.toThrow(ForbiddenError)
    expect(ordersRepo.updateStatus).not.toHaveBeenCalled()
  })

  it('succeeded -- delega para confirmPayment (PENDING → PAID)', async () => {
    const ordersRepo = makeMockOrdersRepo()
    vi.mocked(ordersRepo.findById).mockResolvedValue(makeOrder({ status: OrderStatus.PENDING }) as never)
    const holdRepo = makeMockHoldRepo()
    vi.mocked(holdRepo.findByOrderId).mockResolvedValue([{ id: 'hold-1', seatId: 'seat-1' }] as never)

    const service = makeService({ ordersRepo, holdRepo })
    await service.simulatePayment('order-1', 'user-1', 'succeeded', log)

    expect(ordersRepo.updateStatus).toHaveBeenCalledWith('fake-tx', 'order-1', OrderStatus.PAID)
  })

  it('requires_payment_method -- delega para failPayment (PENDING → FAILED), preserva o hold', async () => {
    const ordersRepo = makeMockOrdersRepo()
    vi.mocked(ordersRepo.findById).mockResolvedValue(makeOrder({ status: OrderStatus.PENDING }) as never)
    const holdRepo = makeMockHoldRepo()

    const service = makeService({ ordersRepo, holdRepo })
    await service.simulatePayment('order-1', 'user-1', 'requires_payment_method', log)

    expect(ordersRepo.updateStatus).toHaveBeenCalledWith(expect.anything(), 'order-1', OrderStatus.FAILED)
    expect(holdRepo.consume).not.toHaveBeenCalled()
  })

  it('404 -- order de outro usuário (privado, não revela)', async () => {
    const ordersRepo = makeMockOrdersRepo()
    vi.mocked(ordersRepo.findById).mockResolvedValue(makeOrder({ userId: 'user-2' }) as never)

    const service = makeService({ ordersRepo })
    await expect(service.simulatePayment('order-1', 'user-1', 'succeeded', log)).rejects.toThrow(NotFoundError)
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
      { FAKE: makeMockPaymentProvider(), STRIPE: makeMockPaymentProvider() },
    )

    expect(await service.recordWebhookEvent('evt_1', 'payment_intent.succeeded')).toBe(true)
  })
})
