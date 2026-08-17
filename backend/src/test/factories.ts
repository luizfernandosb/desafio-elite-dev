import { randomUUID } from 'node:crypto'
import supertest from 'supertest'
import { app } from '../app'
import { env } from '../config/env'
import { EventStatus, Role } from '../../generated/prisma/enums'
import { stripe } from '../lib/stripe'
import { prisma } from '../lib/prisma'
import { signAccessToken } from '../modules/auth/token.service'

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
      venueState: 'SP',
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

export function signWebhook(type: string, paymentIntentId: string) {
  const payload = JSON.stringify({
    id: `evt_${randomUUID()}`,
    object: 'event',
    type,
    data: { object: { id: paymentIntentId, object: 'payment_intent' } },
  })
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: env.STRIPE_WEBHOOK_SECRET })
  return { payload, signature }
}

export async function seedPaidTicket(opts: { seatCount?: number; startsAt?: Date; endsAt?: Date | null } = {}) {
  const seatCount = opts.seatCount ?? 1
  const { organizer, event, seats } = await seedEventWithSeats({
    seatCount,
    startsAt: opts.startsAt,
    endsAt: opts.endsAt,
  })
  const customer = await seedUser(Role.CUSTOMER)
  const token = signAccessToken({ sub: customer.id, role: Role.CUSTOMER })

  const holds = await Promise.all(
    seats.map(async (seat) => {
      const hold = await prisma.seatHold.create({
        data: { eventId: event.id, seatId: seat.id, userId: customer.id, expiresAt: new Date(Date.now() + 600_000) },
      })
      await prisma.seatState.update({
        where: { seatId: seat.id },
        data: { status: 'HELD', expiresAt: hold.expiresAt },
      })
      return hold
    }),
  )

  const created = await supertest(app)
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', randomUUID())
    .send({ eventId: event.id, holdIds: holds.map((h) => h.id) })
  if (created.status !== 201) {
    throw new Error(`seedPaidTicket: POST /orders falhou -- ${created.status} ${JSON.stringify(created.body)}`)
  }

  const order = created.body.order as { id: string; stripePaymentIntentId: string }
  const { payload, signature } = signWebhook('payment_intent.succeeded', order.stripePaymentIntentId)
  const webhookRes = await supertest(app)
    .post('/api/v1/stripe/webhook')
    .set('Content-Type', 'application/json')
    .set('Stripe-Signature', signature)
    .send(payload)
  if (webhookRes.status !== 200) {
    throw new Error(`seedPaidTicket: webhook falhou -- ${webhookRes.status} ${JSON.stringify(webhookRes.body)}`)
  }

  const tickets = await prisma.ticket.findMany({ where: { orderId: order.id }, orderBy: { createdAt: 'asc' } })

  return {
    organizer,
    event,
    seats,
    tickets,
    ticket: tickets[0]!,
    seat: seats[0]!,
    customer,
    token,
    orderId: order.id,
  }
}
