import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../../lib/prisma'
import { cleanDatabase } from '../../test/setup'
import { seedEventWithSeats, seedUser } from '../../test/factories'

const EXPIRE_SEAT_HOLDS_SQL = `
  WITH expired AS (
    UPDATE "SeatHold" SET "releasedAt" = now()
     WHERE "releasedAt" IS NULL AND "expiresAt" < now()
    RETURNING "seatId"
  )
  UPDATE "seat_state" s SET status = 'FREE', "expiresAt" = NULL, "updatedAt" = now()
    FROM expired e WHERE s."seatId" = e."seatId" AND s.status = 'HELD';
`

describe('job pg_cron "expire-seat-holds" (etapa 11, §4.4.3)', () => {
  beforeEach(cleanDatabase)

  it('hold vencido -- SeatHold ganha releasedAt e seat_state vira FREE', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 1 })
    const seat = seats[0]!
    const user = await seedUser()

    await prisma.seatHold.create({
      data: { eventId: event.id, seatId: seat.id, userId: user.id, expiresAt: new Date(Date.now() - 60_000) },
    })
    await prisma.seatState.update({
      where: { seatId: seat.id },
      data: { status: 'HELD', expiresAt: new Date(Date.now() - 60_000) },
    })

    await prisma.$executeRawUnsafe(EXPIRE_SEAT_HOLDS_SQL)

    const hold = await prisma.seatHold.findFirstOrThrow({ where: { seatId: seat.id } })
    expect(hold.releasedAt).not.toBeNull()

    const state = await prisma.seatState.findUniqueOrThrow({ where: { seatId: seat.id } })
    expect(state.status).toBe('FREE')
    expect(state.expiresAt).toBeNull()
  })

  it('assento já SOLD -- job não reverte mesmo com hold vencido (corrida com o webhook)', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 1 })
    const seat = seats[0]!
    const user = await seedUser()

    await prisma.seatHold.create({
      data: { eventId: event.id, seatId: seat.id, userId: user.id, expiresAt: new Date(Date.now() - 60_000) },
    })
    await prisma.seatState.update({ where: { seatId: seat.id }, data: { status: 'SOLD', expiresAt: null } })

    await prisma.$executeRawUnsafe(EXPIRE_SEAT_HOLDS_SQL)

    const state = await prisma.seatState.findUniqueOrThrow({ where: { seatId: seat.id } })
    expect(state.status).toBe('SOLD')
  })

  it('hold ainda não vencido -- seat_state permanece HELD', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 1 })
    const seat = seats[0]!
    const user = await seedUser()

    await prisma.seatHold.create({
      data: { eventId: event.id, seatId: seat.id, userId: user.id, expiresAt: new Date(Date.now() + 600_000) },
    })
    await prisma.seatState.update({
      where: { seatId: seat.id },
      data: { status: 'HELD', expiresAt: new Date(Date.now() + 600_000) },
    })

    await prisma.$executeRawUnsafe(EXPIRE_SEAT_HOLDS_SQL)

    const state = await prisma.seatState.findUniqueOrThrow({ where: { seatId: seat.id } })
    expect(state.status).toBe('HELD')
  })
})
