import { randomUUID } from 'node:crypto'
import supertest from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { app } from '../../app'
import { env } from '../../config/env'
import { stripe } from '../../lib/stripe'
import { prisma } from '../../lib/prisma'
import { Role } from '../../../generated/prisma/enums'
import { signAccessToken } from '../auth/token.service'
import { cleanDatabase } from '../../test/setup'
import { seedEventWithSeats, seedUser } from '../../test/factories'
import { verifyTicketCode } from './qr.service'

function signWebhook(type: string, paymentIntentId: string) {
  const payload = JSON.stringify({
    id: `evt_${randomUUID()}`,
    object: 'event',
    type,
    data: { object: { id: paymentIntentId, object: 'payment_intent' } },
  })
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: env.STRIPE_WEBHOOK_SECRET })
  return { payload, signature }
}

async function payForSeats(seatCount: number) {
  const { event, seats } = await seedEventWithSeats({ seatCount })
  const customer = await seedUser(Role.CUSTOMER)
  const token = signAccessToken({ sub: customer.id, role: Role.CUSTOMER })

  const holds = await Promise.all(
    seats.map(async (seat) => {
      const hold = await prisma.seatHold.create({
        data: { eventId: event.id, seatId: seat.id, userId: customer.id, expiresAt: new Date(Date.now() + 600_000) },
      })
      await prisma.seatState.update({ where: { seatId: seat.id }, data: { status: 'HELD', expiresAt: hold.expiresAt } })
      return hold
    }),
  )

  const created = await supertest(app)
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', randomUUID())
    .send({ eventId: event.id, holdIds: holds.map((h) => h.id) })

  const order = created.body.order as { id: string; stripePaymentIntentId: string }
  const { payload, signature } = signWebhook('payment_intent.succeeded', order.stripePaymentIntentId)
  const webhookRes = await supertest(app)
    .post('/api/v1/stripe/webhook')
    .set('Content-Type', 'application/json')
    .set('Stripe-Signature', signature)
    .send(payload)
  if (webhookRes.status !== 200) throw new Error(`webhook falhou: ${webhookRes.status} ${JSON.stringify(webhookRes.body)}`)

  return { event, seats, customer, token, orderId: order.id }
}

describe('pagamento aprovado emite ingressos', () => {
  beforeEach(cleanDatabase)

  it('3 assentos pagos emitem exatamente 3 ingressos ACTIVE e marcam os 3 assentos SOLD', async () => {
    const { seats, orderId } = await payForSeats(3)

    const tickets = await prisma.ticket.findMany({ where: { orderId } })
    expect(tickets).toHaveLength(3)
    expect(tickets.every((t) => t.status === 'ACTIVE')).toBe(true)

    const states = await prisma.seatState.findMany({ where: { seatId: { in: seats.map((s) => s.id) } } })
    expect(states.every((s) => s.status === 'SOLD')).toBe(true)
  })
})

describe('GET /api/v1/tickets', () => {
  beforeEach(cleanDatabase)

  it('lista os ingressos do usuário sem o campo code', async () => {
    const { token } = await payForSeats(1)

    const res = await supertest(app).get('/api/v1/tickets').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].code).toBeUndefined()
    expect(JSON.stringify(res.body)).not.toContain('codeHash')
    expect(JSON.stringify(res.body)).not.toContain('qrJti')
  })

  it('401 -- sem token', async () => {
    const res = await supertest(app).get('/api/v1/tickets')
    expect(res.status).toBe(401)
  })

  it('403 -- organizador não acessa "meus ingressos"', async () => {
    const org = await seedUser(Role.ORGANIZER)
    const token = signAccessToken({ sub: org.id, role: Role.ORGANIZER })
    const res = await supertest(app).get('/api/v1/tickets').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })
})

describe('GET /api/v1/tickets/:id', () => {
  beforeEach(cleanDatabase)

  it('200 -- dono recebe o code, e o code verifica contra o próprio ticket', async () => {
    const { token, orderId } = await payForSeats(1)
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { orderId } })

    const res = await supertest(app).get(`/api/v1/tickets/${ticket.id}`).set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(typeof res.body.code).toBe('string')
    expect(verifyTicketCode(res.body.code, { ticketId: ticket.id, eventId: ticket.eventId })).toBe(true)
  })

  it('404 -- outro cliente não pode ler o ingresso (privado, não revela)', async () => {
    const { orderId } = await payForSeats(1)
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { orderId } })
    const other = await seedUser(Role.CUSTOMER)
    const otherToken = signAccessToken({ sub: other.id, role: Role.CUSTOMER })

    const res = await supertest(app)
      .get(`/api/v1/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${otherToken}`)

    expect(res.status).toBe(404)
  })
})
