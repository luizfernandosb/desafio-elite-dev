import { randomUUID } from 'node:crypto'
import { EventStatus, Role } from '../../generated/prisma/enums'
import { prisma } from '../lib/prisma'

export async function seedUser(role: Role = Role.CUSTOMER) {
  return prisma.user.create({
    data: { email: `${role.toLowerCase()}-${randomUUID()}@test.com`, name: `Teste ${role}`, role },
  })
}

export async function seedEventWithSeats(
  opts: { seatCount?: number; status?: EventStatus; startsAt?: Date; endsAt?: Date | null } = {},
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
      // 24h no futuro por padrão -- fora da janela de portaria de propósito (2h antes
      // até 6h depois, §4.6.3). Testes de portaria (etapa 10) passam um `startsAt`
      // dentro da janela explicitamente.
      startsAt: opts.startsAt ?? new Date(Date.now() + 86_400_000),
      endsAt: opts.endsAt,
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
