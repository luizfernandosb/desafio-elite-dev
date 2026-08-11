import type { Logger } from 'pino'
import { describe, expect, it, vi } from 'vitest'
import { Prisma } from '../../../generated/prisma/client'
import { EventStatus } from '../../../generated/prisma/enums'
import { AppError, ConflictError, NotFoundError } from '../../shared/errors'
import type { EventsRepository } from '../events/events.repository'
import type { SeatHoldRepository } from './seat-hold.repository'
import { SeatHoldService } from './seat-hold.service'
import type { SeatRepository } from './seat.repository'
import type { SeatStateRepository } from './seat-state.repository'

vi.mock('../../lib/prisma', () => ({
  prisma: { $transaction: (callback: (tx: string) => unknown) => callback('fake-tx') },
}))

function makeEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: 'event-1', status: EventStatus.PUBLISHED, ...overrides }
}

function makeMockHoldRepo(): SeatHoldRepository {
  return {
    createMany: vi.fn(),
    countActiveForUser: vi.fn().mockResolvedValue(0),
    releaseExpiredAmong: vi.fn().mockResolvedValue(0),
    findActiveSeatIds: vi.fn().mockResolvedValue([]),
    findOwnedById: vi.fn(),
    release: vi.fn(),
    findActiveByUser: vi.fn(),
  } as unknown as SeatHoldRepository
}

function makeMockSeatStateRepo(): SeatStateRepository {
  return { markHeld: vi.fn(), markFree: vi.fn() } as unknown as SeatStateRepository
}

function makeMockEventsRepo(event = makeEvent()): EventsRepository {
  return { findById: vi.fn().mockResolvedValue(event) } as unknown as EventsRepository
}

function makeMockSeatRepo(count = 2): SeatRepository {
  return { countInEvent: vi.fn().mockResolvedValue(count) } as unknown as SeatRepository
}

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as Logger

// isUniqueViolation checa `instanceof Prisma.PrismaClientKnownRequestError` -- simula
// isso sem precisar do construtor real (que exige argumentos internos do engine)
function p2002() {
  const err = new Error('unique violation') as Error & { code: string }
  err.code = 'P2002'
  Object.setPrototypeOf(err, Prisma.PrismaClientKnownRequestError.prototype)
  return err
}

describe('SeatHoldService.hold', () => {
  const seatIds = ['seat-1', 'seat-2']

  it('404 -- evento não existe', async () => {
    const eventsRepo = { findById: vi.fn().mockResolvedValue(null) } as unknown as EventsRepository
    const service = new SeatHoldService(makeMockHoldRepo(), makeMockSeatStateRepo(), eventsRepo, makeMockSeatRepo())

    await expect(service.hold('user-1', 'event-1', seatIds, log)).rejects.toThrow(NotFoundError)
  })

  it('409 -- evento não está PUBLISHED', async () => {
    const eventsRepo = makeMockEventsRepo(makeEvent({ status: EventStatus.DRAFT }))
    const service = new SeatHoldService(makeMockHoldRepo(), makeMockSeatStateRepo(), eventsRepo, makeMockSeatRepo())

    await expect(service.hold('user-1', 'event-1', seatIds, log)).rejects.toThrow(ConflictError)
  })

  it('422 -- assento não pertence ao evento', async () => {
    const service = new SeatHoldService(
      makeMockHoldRepo(),
      makeMockSeatStateRepo(),
      makeMockEventsRepo(),
      makeMockSeatRepo(1), // só 1 de 2 pertence
    )

    await expect(service.hold('user-1', 'event-1', seatIds, log)).rejects.toThrow(AppError)
  })

  it('409 HOLD_LIMIT_EXCEEDED -- já tem holds ativos suficientes para bater o teto', async () => {
    const holdRepo = makeMockHoldRepo()
    vi.mocked(holdRepo.countActiveForUser).mockResolvedValue(5)
    const service = new SeatHoldService(holdRepo, makeMockSeatStateRepo(), makeMockEventsRepo(), makeMockSeatRepo())

    await expect(service.hold('user-1', 'event-1', seatIds, log)).rejects.toThrow(ConflictError)
  })

  it('sucesso: cria os holds e marca SeatState como HELD', async () => {
    const holdRepo = makeMockHoldRepo()
    const seatStateRepo = makeMockSeatStateRepo()
    const service = new SeatHoldService(holdRepo, seatStateRepo, makeMockEventsRepo(), makeMockSeatRepo())

    const holds = await service.hold('user-1', 'event-1', seatIds, log)

    expect(holds).toHaveLength(2)
    expect(holdRepo.createMany).toHaveBeenCalledWith('fake-tx', expect.any(Array))
    expect(seatStateRepo.markHeld).toHaveBeenCalledWith('fake-tx', seatIds, expect.any(Date))
  })

  it('P2002 nunca vaza para o chamador -- vira ConflictError SEAT_TAKEN com takenSeatIds', async () => {
    const holdRepo = makeMockHoldRepo()
    vi.mocked(holdRepo.createMany).mockRejectedValue(p2002())
    vi.mocked(holdRepo.findActiveSeatIds).mockResolvedValue(['seat-1'])
    const service = new SeatHoldService(holdRepo, makeMockSeatStateRepo(), makeMockEventsRepo(), makeMockSeatRepo())

    const error = await service.hold('user-1', 'event-1', seatIds, log).catch((e) => e)

    expect(error).toBeInstanceOf(ConflictError)
    expect(error.code).toBe('SEAT_TAKEN')
    expect(error.details).toEqual({ takenSeatIds: ['seat-1'] })
    expect(holdRepo.releaseExpiredAmong).toHaveBeenCalled() // tentou a liberação preguiçosa
  })

  it('liberação preguiçosa: se a segunda tentativa funciona, devolve sucesso sem propagar o erro', async () => {
    const holdRepo = makeMockHoldRepo()
    vi.mocked(holdRepo.createMany).mockRejectedValueOnce(p2002()).mockResolvedValueOnce(undefined as never)
    const seatStateRepo = makeMockSeatStateRepo()
    const service = new SeatHoldService(holdRepo, seatStateRepo, makeMockEventsRepo(), makeMockSeatRepo())

    const holds = await service.hold('user-1', 'event-1', seatIds, log)

    expect(holds).toHaveLength(2)
    expect(holdRepo.createMany).toHaveBeenCalledTimes(2)
  })
})

describe('SeatHoldService.release', () => {
  it('404 -- hold não existe ou não é do usuário (privado, não revela)', async () => {
    const holdRepo = makeMockHoldRepo()
    vi.mocked(holdRepo.findOwnedById).mockResolvedValue(null)
    const service = new SeatHoldService(holdRepo, makeMockSeatStateRepo(), makeMockEventsRepo(), makeMockSeatRepo())

    await expect(service.release('user-1', 'event-1', 'hold-1', log)).rejects.toThrow(NotFoundError)
  })

  it('idempotente: hold já liberado não lança erro nem escreve de novo', async () => {
    const holdRepo = makeMockHoldRepo()
    vi.mocked(holdRepo.findOwnedById).mockResolvedValue({
      id: 'hold-1',
      seatId: 'seat-1',
      releasedAt: new Date(),
    } as never)
    const service = new SeatHoldService(holdRepo, makeMockSeatStateRepo(), makeMockEventsRepo(), makeMockSeatRepo())

    await service.release('user-1', 'event-1', 'hold-1', log)
    expect(holdRepo.release).not.toHaveBeenCalled()
  })

  it('libera o hold e marca o assento como FREE', async () => {
    const holdRepo = makeMockHoldRepo()
    const seatStateRepo = makeMockSeatStateRepo()
    vi.mocked(holdRepo.findOwnedById).mockResolvedValue({
      id: 'hold-1',
      seatId: 'seat-1',
      releasedAt: null,
    } as never)
    const service = new SeatHoldService(holdRepo, seatStateRepo, makeMockEventsRepo(), makeMockSeatRepo())

    await service.release('user-1', 'event-1', 'hold-1', log)

    expect(holdRepo.release).toHaveBeenCalledWith('fake-tx', 'hold-1')
    expect(seatStateRepo.markFree).toHaveBeenCalledWith('fake-tx', ['seat-1'])
  })
})
