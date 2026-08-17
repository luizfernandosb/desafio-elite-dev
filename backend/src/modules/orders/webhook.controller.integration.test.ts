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

function buildSignedWebhookRequest(type: string, paymentIntentId: string, eventId = `evt_${randomUUID()}`) {
  const payload = JSON.stringify({
    id: eventId,
    object: 'event',
    type,
    data: { object: { id: paymentIntentId, object: 'payment_intent' } },
  })
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: env.STRIPE_WEBHOOK_SECRET })
  return { payload, signature }
}

function postWebhook(payload: string, signature: string) {
  return supertest(app)
    .post('/api/v1/stripe/webhook')
    .set('Content-Type', 'application/json')
    .set('Stripe-Signature', signature)
    .send(payload)
}

async function createPendingOrder() {
  const { event, seats } = await seedEventWithSeats({ seatCount: 1 })
  const customer = await seedUser(Role.CUSTOMER)
  const token = signAccessToken({ sub: customer.id, role: Role.CUSTOMER })

  const holdExpiresAt = new Date(Date.now() + 600_000)
  const hold = await prisma.seatHold.create({
    data: { eventId: event.id, seatId: seats[0]!.id, userId: customer.id, expiresAt: holdExpiresAt },
  })
  await prisma.seatState.update({
    where: { seatId: seats[0]!.id },
    data: { status: 'HELD', expiresAt: holdExpiresAt },
  })

  const created = await supertest(app)
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', randomUUID())
    .send({ eventId: event.id, holdIds: [hold.id] })

  return { event, seat: seats[0]!, customer, order: created.body.order as { id: string; stripePaymentIntentId: string } }
}

describe('POST /api/v1/stripe/webhook', () => {
  beforeEach(cleanDatabase)

  it('assinatura adulterada -- 400, nada processado', async () => {
    const { order } = await createPendingOrder()
    const { payload } = buildSignedWebhookRequest('payment_intent.succeeded', order.stripePaymentIntentId)

    const res = await postWebhook(payload, 't=1,v1=assinatura-forjada')
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_SIGNATURE')

    const unchanged = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(unchanged.status).toBe('PENDING')
  })

  it('payment_intent.succeeded: Order PAID + ingresso emitido + hold consumido + assento SOLD', async () => {
    const { order, seat } = await createPendingOrder()
    const { payload, signature } = buildSignedWebhookRequest('payment_intent.succeeded', order.stripePaymentIntentId)

    const res = await postWebhook(payload, signature)
    expect(res.status).toBe(200)

    const paid = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(paid.status).toBe('PAID')

    const tickets = await prisma.ticket.findMany({ where: { orderId: order.id } })
    expect(tickets).toHaveLength(1)
    expect(tickets[0]?.status).toBe('ACTIVE')

    const seatState = await prisma.seatState.findUniqueOrThrow({ where: { seatId: seat.id } })
    expect(seatState.status).toBe('SOLD')

    const hold = await prisma.seatHold.findFirstOrThrow({ where: { seatId: seat.id } })
    expect(hold.releasedAt).not.toBeNull()
  })

  it('payment_intent.payment_failed: Order FAILED, hold preservado (não libera o assento)', async () => {
    const { order, seat } = await createPendingOrder()
    const { payload, signature } = buildSignedWebhookRequest('payment_intent.payment_failed', order.stripePaymentIntentId)

    const res = await postWebhook(payload, signature)
    expect(res.status).toBe(200)

    const failed = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(failed.status).toBe('FAILED')

    const hold = await prisma.seatHold.findFirstOrThrow({ where: { seatId: seat.id } })
    expect(hold.releasedAt).toBeNull()

    const seatState = await prisma.seatState.findUniqueOrThrow({ where: { seatId: seat.id } })
    expect(seatState.status).toBe('HELD')
  })

  it('mesmo webhook entregue duas vezes -- um único ingresso', async () => {
    const { order } = await createPendingOrder()
    const { payload, signature } = buildSignedWebhookRequest('payment_intent.succeeded', order.stripePaymentIntentId)

    const first = await postWebhook(payload, signature)
    const second = await postWebhook(payload, signature)

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)

    const tickets = await prisma.ticket.findMany({ where: { orderId: order.id } })
    expect(tickets).toHaveLength(1)
  })

  it('200 (não 500) quando não há Order para o paymentIntentId -- falha permanente, não reentrega', async () => {
    const { payload, signature } = buildSignedWebhookRequest('payment_intent.succeeded', 'pi_inexistente')
    const res = await postWebhook(payload, signature)
    expect(res.status).toBe(200)
  })
})
