import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../../lib/prisma'
import { cleanDatabase } from '../../test/setup'
import { seedEventWithSeats, seedUser } from '../../test/factories'
import { isUniqueViolation } from '../../shared/prisma-errors'
import { SeatHoldRepository } from './seat-hold.repository'
import { SeatStateRepository } from './seat-state.repository'

async function seedUsers(count: number) {
  const users = await Promise.all(Array.from({ length: count }, () => seedUser()))
  return users.map((u) => u.id)
}

describe('anti-double-booking -- assento marcado (§7.10.4, teste nº 1)', () => {
  beforeEach(cleanDatabase)

  it('N requisições concorrentes no mesmo assento: exatamente 1 sucesso', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 10 })
    const targetSeat = seats[0]!
    const repo = new SeatHoldRepository()

    const CONCURRENCY = 20
    const userIds = await seedUsers(CONCURRENCY)
    const results = await Promise.allSettled(
      userIds.map((userId) =>
        prisma.$transaction((tx) =>
          repo.createMany(tx, [
            {
              id: randomUUID(),
              eventId: event.id,
              seatId: targetSeat.id,
              userId,
              priceType: 'FULL',
              expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
          ]),
        ),
      ),
    )

    const successes = results.filter((r) => r.status === 'fulfilled')
    const failures = results.filter((r) => r.status === 'rejected')

    expect(successes).toHaveLength(1)
    expect(failures).toHaveLength(CONCURRENCY - 1)
    failures.forEach((f) => {
      expect(isUniqueViolation((f as PromiseRejectedResult).reason)).toBe(true)
    })

    const activeHolds = await prisma.seatHold.count({
      where: { seatId: targetSeat.id, releasedAt: null },
    })
    expect(activeHolds).toBe(1)
  })

  it('N requisições concorrentes em assentos distintos: todos os N com sucesso', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 10 })
    const repo = new SeatHoldRepository()
    const userIds = await seedUsers(seats.length)

    const results = await Promise.allSettled(
      seats.map((seat, i) =>
        prisma.$transaction((tx) =>
          repo.createMany(tx, [
            {
              id: randomUUID(),
              eventId: event.id,
              seatId: seat.id,
              userId: userIds[i]!,
              priceType: 'FULL',
              expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
          ]),
        ),
      ),
    )

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
  })

  it('reserva múltipla parcialmente indisponível: rollback total, zero holds criados', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 3 })
    const repo = new SeatHoldRepository()
    const [seatA, seatB, seatC] = seats as [typeof seats[0], typeof seats[0], typeof seats[0]]
    const [otherUserId, attemptUserId] = await seedUsers(2)

    await prisma.seatHold.create({
      data: {
        eventId: event.id,
        seatId: seatB.id,
        userId: otherUserId!,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    })

    await expect(
      prisma.$transaction((tx) =>
        repo.createMany(tx, [
          { id: randomUUID(), eventId: event.id, seatId: seatA.id, userId: attemptUserId!, priceType: 'FULL', expiresAt: new Date(Date.now() + 600_000) },
          { id: randomUUID(), eventId: event.id, seatId: seatB.id, userId: attemptUserId!, priceType: 'FULL', expiresAt: new Date(Date.now() + 600_000) },
          { id: randomUUID(), eventId: event.id, seatId: seatC.id, userId: attemptUserId!, priceType: 'FULL', expiresAt: new Date(Date.now() + 600_000) },
        ]),
      ),
    ).rejects.toSatisfy(isUniqueViolation)

    const holdsFromAttempt = await prisma.seatHold.count({ where: { userId: attemptUserId! } })
    expect(holdsFromAttempt).toBe(0)
  })

  it('hold vencido não bloqueia: expiração preguiçosa libera antes do índice recusar', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 1 })
    const seat = seats[0]!
    const repo = new SeatHoldRepository()
    const [oldUserId, newUserId] = await seedUsers(2)

    await prisma.seatHold.create({
      data: {
        eventId: event.id,
        seatId: seat.id,
        userId: oldUserId!,
        expiresAt: new Date(Date.now() - 60_000),
      },
    })

    const releasedCount = await repo.releaseExpiredAmong(prisma, [seat.id])
    expect(releasedCount).toBe(1)

    await expect(
      prisma.$transaction((tx) =>
        repo.createMany(tx, [
          { id: randomUUID(), eventId: event.id, seatId: seat.id, userId: newUserId!, priceType: 'FULL', expiresAt: new Date(Date.now() + 600_000) },
        ]),
      ),
    ).resolves.toBeDefined()
  })
})

describe('seat_state -- escrita dupla é transacional (etapa 11, §4.4.2)', () => {
  beforeEach(cleanDatabase)

  it('hold criado -- seat_state vira HELD com expiresAt na mesma transação', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 1 })
    const seat = seats[0]!
    const repo = new SeatHoldRepository()
    const seatStateRepo = new SeatStateRepository()
    const [userId] = await seedUsers(1)
    const expiresAt = new Date(Date.now() + 600_000)

    await prisma.$transaction(async (tx) => {
      await repo.createMany(tx, [
        { id: randomUUID(), eventId: event.id, seatId: seat.id, userId: userId!, priceType: 'FULL', expiresAt },
      ])
      await seatStateRepo.markHeld(tx, [seat.id], expiresAt)
    })

    const state = await prisma.seatState.findUniqueOrThrow({ where: { seatId: seat.id } })
    expect(state.status).toBe('HELD')
    expect(state.expiresAt).toEqual(expiresAt)
  })

  it('rollback do hold não deixa seat_state como HELD -- prova a escrita dupla transacional', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 1 })
    const seat = seats[0]!
    const repo = new SeatHoldRepository()
    const seatStateRepo = new SeatStateRepository()
    const [ownerId, attemptId] = await seedUsers(2)

    await prisma.seatHold.create({
      data: { eventId: event.id, seatId: seat.id, userId: ownerId!, expiresAt: new Date(Date.now() + 600_000) },
    })

    await expect(
      prisma.$transaction(async (tx) => {
        await seatStateRepo.markHeld(tx, [seat.id], new Date(Date.now() + 600_000))
        await repo.createMany(tx, [
          {
            id: randomUUID(),
            eventId: event.id,
            seatId: seat.id,
            userId: attemptId!,
            priceType: 'FULL',
            expiresAt: new Date(Date.now() + 600_000),
          },
        ])
      }),
    ).rejects.toSatisfy(isUniqueViolation)

    const state = await prisma.seatState.findUniqueOrThrow({ where: { seatId: seat.id } })
    expect(state.status).toBe('FREE')
  })
})
