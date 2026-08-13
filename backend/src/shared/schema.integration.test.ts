import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../lib/prisma'
import { cleanDatabase } from '../test/setup'

async function seedEventWithSeat() {
  const organizer = await prisma.user.create({
    data: { email: `organizer-${crypto.randomUUID()}@test.com`, name: 'Organizador' },
  })
  const event = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      externalId: 'tmdb-1',
      title: 'Show de teste',
      venueName: 'Arena',
      venueCity: 'São Paulo',
      venueState: 'SP',
      startsAt: new Date(),
      timezone: 'America/Sao_Paulo',
      priceInCents: 5000,
    },
  })
  const seat = await prisma.seat.create({
    data: { eventId: event.id, row: 'A', number: 1 },
  })
  return { organizer, event, seat }
}

describe('índices parciais -- anti-double-booking', () => {
  beforeEach(cleanDatabase)

  it('seat_hold_active: só permite um SeatHold ativo (releasedAt null) por assento', async () => {
    const { event, seat, organizer } = await seedEventWithSeat()
    const customer = await prisma.user.create({
      data: { email: `customer-${crypto.randomUUID()}@test.com`, name: 'Cliente' },
    })

    await prisma.seatHold.create({
      data: {
        eventId: event.id,
        seatId: seat.id,
        userId: organizer.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
    })

    await expect(
      prisma.seatHold.create({
        data: {
          eventId: event.id,
          seatId: seat.id,
          userId: customer.id,
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })

  it('um SeatHold liberado (releasedAt preenchido) não bloqueia um novo hold no mesmo assento', async () => {
    const { event, seat, organizer } = await seedEventWithSeat()

    await prisma.seatHold.create({
      data: {
        eventId: event.id,
        seatId: seat.id,
        userId: organizer.id,
        expiresAt: new Date(Date.now() + 60_000),
        releasedAt: new Date(),
      },
    })

    await expect(
      prisma.seatHold.create({
        data: {
          eventId: event.id,
          seatId: seat.id,
          userId: organizer.id,
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    ).resolves.toMatchObject({ seatId: seat.id })
  })

  it('ticket_seat_unique: só permite um Ticket por (eventId, seatId)', async () => {
    const { event, seat, organizer } = await seedEventWithSeat()
    const order = await prisma.order.create({
      data: {
        userId: organizer.id,
        eventId: event.id,
        amountInCents: 5000,
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    })

    await prisma.ticket.create({
      data: {
        orderId: order.id,
        eventId: event.id,
        seatId: seat.id,
        codeHash: `hash-${crypto.randomUUID()}`,
        qrJti: crypto.randomUUID(),
      },
    })

    await expect(
      prisma.ticket.create({
        data: {
          orderId: order.id,
          eventId: event.id,
          seatId: seat.id,
          codeHash: `hash-${crypto.randomUUID()}`,
          qrJti: crypto.randomUUID(),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })
})
