import { randomUUID } from 'node:crypto'
import { EventStatus, Role } from '../../generated/prisma/enums'
import { prisma } from '../lib/prisma'

export async function seedUser(role: Role = Role.CUSTOMER) {
  return prisma.user.create({
    data: { email: `${role.toLowerCase()}-${randomUUID()}@test.com`, name: `Teste ${role}`, role },
  })
}

export async function seedEventWithSeats(
  opts: { seatCount?: number; status?: EventStatus } = {},
) {
  const seatCount = opts.seatCount ?? 10
  const organizer = await seedUser(Role.ORGANIZER)

  const event = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      externalId: `ext-${randomUUID()}`,
      title: 'Evento de teste',
      venueName: 'Casa de Shows',
      venueCity: 'São Paulo',
      startsAt: new Date(Date.now() + 86_400_000),
      timezone: 'America/Sao_Paulo',
      priceInCents: 5000,
      status: opts.status ?? EventStatus.PUBLISHED,
    },
  })

  const seats = await Promise.all(
    Array.from({ length: seatCount }, (_, i) =>
      prisma.seat.create({ data: { eventId: event.id, row: 'A', number: i + 1 } }),
    ),
  )

  await prisma.seatState.createMany({
    data: seats.map((seat) => ({ seatId: seat.id, eventId: event.id })),
  })

  return { organizer, event, seats }
}
