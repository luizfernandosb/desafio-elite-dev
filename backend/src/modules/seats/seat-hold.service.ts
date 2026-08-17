import { randomUUID } from 'node:crypto'
import type { Logger } from 'pino'
import { EventStatus } from '../../../generated/prisma/enums'
import { prisma } from '../../lib/prisma'
import type { TicketPriceType } from '../../../generated/prisma/enums'
import { AppError, ConflictError, NotFoundError } from '../../shared/errors'
import { isUniqueViolation } from '../../shared/prisma-errors'
import type { EventsRepository } from '../events/events.repository'
import { MAX_SEATS_PER_HOLD, type SeatSelectionDto } from './seat-hold.schema'
import type { SeatHoldRepository } from './seat-hold.repository'
import type { SeatRepository } from './seat.repository'
import type { SeatStateRepository } from './seat-state.repository'

const HOLD_TTL_MS = 10 * 60 * 1000

export interface SeatHold {
  id: string
  eventId: string
  seatId: string
  userId: string
  priceType: TicketPriceType
  expiresAt: Date
}

export class SeatHoldService {
  constructor(
    private readonly repo: SeatHoldRepository,
    private readonly seatStateRepo: SeatStateRepository,
    private readonly eventsRepo: EventsRepository,
    private readonly seatRepo: SeatRepository,
  ) {}

  async hold(userId: string, eventId: string, seats: SeatSelectionDto[], log: Logger): Promise<SeatHold[]> {
    const seatIds = seats.map((s) => s.seatId)

    const event = await this.eventsRepo.findById(prisma, eventId)
    if (!event) throw new NotFoundError('Evento')
    if (event.status !== EventStatus.PUBLISHED) {
      throw new ConflictError('EVENT_NOT_PUBLISHED', 'Evento não está publicado')
    }

    const belonging = await this.seatRepo.countInEvent(prisma, eventId, seatIds)
    if (belonging !== seatIds.length) {
      throw new AppError('SEAT_NOT_IN_EVENT', 'Assento não pertence a este evento', 422)
    }

    const activeCount = await this.repo.countActiveForUser(prisma, eventId, userId)
    if (activeCount + seatIds.length > MAX_SEATS_PER_HOLD) {
      throw new ConflictError(
        'HOLD_LIMIT_EXCEEDED',
        `Limite de ${MAX_SEATS_PER_HOLD} assentos reservados por evento`,
      )
    }

    try {
      return await this.attemptHold(userId, eventId, seats)
    } catch (err) {
      if (!isUniqueViolation(err)) throw err

      await this.repo.releaseExpiredAmong(prisma, seatIds)

      try {
        return await this.attemptHold(userId, eventId, seats)
      } catch (retryErr) {
        if (!isUniqueViolation(retryErr)) throw retryErr

        const takenSeatIds = await this.repo.findActiveSeatIds(prisma, seatIds)
        log.info({ msg: 'seat hold conflict', eventId, takenSeatIds })
        throw new ConflictError('SEAT_TAKEN', 'Assento já reservado', { takenSeatIds })
      }
    }
  }

  async release(userId: string, eventId: string, holdId: string, log: Logger): Promise<void> {
    const hold = await this.repo.findOwnedById(prisma, holdId, eventId, userId)
    if (!hold) throw new NotFoundError('Hold')

    if (hold.releasedAt) return

    await prisma.$transaction(async (tx) => {
      await this.repo.release(tx, hold.id)
      await this.seatStateRepo.markFree(tx, [hold.seatId])
    })

    log.info({ msg: 'seat hold released', holdId, seatId: hold.seatId })
  }

  listMine(userId: string, eventId: string) {
    return this.repo.findActiveByUser(prisma, eventId, userId)
  }

  private async attemptHold(userId: string, eventId: string, seats: SeatSelectionDto[]): Promise<SeatHold[]> {
    const expiresAt = new Date(Date.now() + HOLD_TTL_MS)
    const holds: SeatHold[] = seats.map(({ seatId, priceType }) => ({
      id: randomUUID(),
      eventId,
      seatId,
      userId,
      priceType,
      expiresAt,
    }))

    return prisma.$transaction(async (tx) => {
      await this.repo.createMany(tx, holds)
      await this.seatStateRepo.markHeld(
        tx,
        holds.map((h) => h.seatId),
        expiresAt,
      )
      return holds
    })
  }
}
