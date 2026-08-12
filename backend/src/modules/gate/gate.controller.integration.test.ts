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
import { generateTicketCode } from '../tickets/qr.service'

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

async function issueTicket() {
  // dentro da janela de portaria (2h antes até 6h depois, §4.6.3) -- o padrão da
  // factory é 24h no futuro, de propósito fora da janela para outros módulos
  const { event, seats } = await seedEventWithSeats({
    seatCount: 1,
    startsAt: new Date(Date.now() - 30 * 60_000),
  })
  const customer = await seedUser(Role.CUSTOMER)
  const customerToken = signAccessToken({ sub: customer.id, role: Role.CUSTOMER })

  const holdExpiresAt = new Date(Date.now() + 600_000)
  const hold = await prisma.seatHold.create({
    data: { eventId: event.id, seatId: seats[0]!.id, userId: customer.id, expiresAt: holdExpiresAt },
  })
  await prisma.seatState.update({ where: { seatId: seats[0]!.id }, data: { status: 'HELD', expiresAt: holdExpiresAt } })

  const created = await supertest(app)
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${customerToken}`)
    .set('Idempotency-Key', randomUUID())
    .send({ eventId: event.id, holdIds: [hold.id] })

  const order = created.body.order as { stripePaymentIntentId: string }
  const { payload, signature } = signWebhook('payment_intent.succeeded', order.stripePaymentIntentId)
  await supertest(app)
    .post('/api/v1/stripe/webhook')
    .set('Content-Type', 'application/json')
    .set('Stripe-Signature', signature)
    .send(payload)

  const ticket = await prisma.ticket.findFirstOrThrow({ where: { eventId: event.id } })

  const gate = await seedUser(Role.GATE)
  const gateToken = signAccessToken({ sub: gate.id, role: Role.GATE })

  return { event, seat: seats[0]!, ticket, gateToken }
}

async function getCode(ticketId: string, ownerToken: string) {
  const res = await supertest(app).get(`/api/v1/tickets/${ticketId}`).set('Authorization', `Bearer ${ownerToken}`)
  return res.body.code as string
}

describe('POST /api/v1/gate/validate', () => {
  beforeEach(cleanDatabase)

  it('fluxo ponta a ponta: comprar → validar (VALID) → validar de novo (ALREADY_USED) → 2 ValidationLog', async () => {
    const { event, ticket, gateToken } = await issueTicket()
    const customer = await prisma.order.findFirstOrThrow({ where: { eventId: event.id } })
    const ownerToken = signAccessToken({ sub: customer.userId, role: Role.CUSTOMER })
    const code = await getCode(ticket.id, ownerToken)

    const first = await supertest(app)
      .post('/api/v1/gate/validate')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ code, eventId: event.id })

    expect(first.status).toBe(200) // sempre 200, mesmo pra resultado negativo
    expect(first.body.result).toBe('VALID')
    expect(first.body.ticket).toEqual({ seat: expect.any(String), eventTitle: event.title })

    const dbTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })
    expect(dbTicket.status).toBe('USED')
    expect(dbTicket.validatedById).not.toBeNull()

    const second = await supertest(app)
      .post('/api/v1/gate/validate')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ code, eventId: event.id })

    expect(second.status).toBe(200)
    expect(second.body.result).toBe('ALREADY_USED')
    expect(second.body.usedAt).not.toBeNull()
    expect(second.body.validatedBy).toBeDefined()

    const logs = await prisma.validationLog.findMany({ where: { ticketId: ticket.id } })
    expect(logs).toHaveLength(2)
    expect(logs.map((l) => l.result).sort()).toEqual(['ALREADY_USED', 'VALID'])
  })

  it('INVALID_SIGNATURE -- código adulterado, sempre 200', async () => {
    const { event, gateToken } = await issueTicket()

    const res = await supertest(app)
      .post('/api/v1/gate/validate')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ code: 'TKT1.forjado.assinatura-errada', eventId: event.id })

    expect(res.status).toBe(200)
    expect(res.body.result).toBe('INVALID_SIGNATURE')
    expect(res.body.ticket).toBeNull()
  })

  it('WRONG_EVENT -- código válido, mas de outro evento', async () => {
    const { ticket } = await issueTicket()
    const other = await issueTicket() // segundo evento + segundo posto
    const customer = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id }, include: { order: true } })
    const ownerToken = signAccessToken({ sub: customer.order.userId, role: Role.CUSTOMER })
    const code = await getCode(ticket.id, ownerToken)

    const res = await supertest(app)
      .post('/api/v1/gate/validate')
      .set('Authorization', `Bearer ${other.gateToken}`)
      .send({ code, eventId: other.event.id })

    expect(res.status).toBe(200)
    expect(res.body.result).toBe('WRONG_EVENT')
    expect(res.body.ticket).toBeNull()
  })

  it('NOT_FOUND -- código genuinamente assinado, mas de um ticket que nunca foi emitido', async () => {
    const { event, gateToken } = await issueTicket()
    // assinado com o segredo real (mesmo mecanismo do qr.service) -- passa o passo 1
    // (assinatura), mas o codeHash não corresponde a nenhum Ticket de verdade
    const { code } = generateTicketCode({ ticketId: 'ticket-nunca-emitido', eventId: event.id })

    const res = await supertest(app)
      .post('/api/v1/gate/validate')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ code, eventId: event.id })

    expect(res.status).toBe(200)
    expect(res.body.result).toBe('NOT_FOUND')
    expect(res.body.ticket).toBeNull()
  })

  it('403 -- cliente não pode validar', async () => {
    const { event } = await issueTicket()
    const customer = await seedUser(Role.CUSTOMER)
    const token = signAccessToken({ sub: customer.id, role: Role.CUSTOMER })

    const res = await supertest(app)
      .post('/api/v1/gate/validate')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'qualquer', eventId: event.id })
    expect(res.status).toBe(403)
  })

  it('403 -- organizador não pode validar', async () => {
    const { event } = await issueTicket()
    const org = await seedUser(Role.ORGANIZER)
    const token = signAccessToken({ sub: org.id, role: Role.ORGANIZER })

    const res = await supertest(app)
      .post('/api/v1/gate/validate')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'qualquer', eventId: event.id })
    expect(res.status).toBe(403)
  })

  it('401 -- sem token', async () => {
    const res = await supertest(app).post('/api/v1/gate/validate').send({ code: 'x', eventId: 'e-1' })
    expect(res.status).toBe(401)
  })

  it('10 validações concorrentes do mesmo ingresso: exatamente 1 sucesso (§7.10.4, teste nº 3)', async () => {
    const { event, ticket, gateToken } = await issueTicket()
    const customer = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id }, include: { order: true } })
    const ownerToken = signAccessToken({ sub: customer.order.userId, role: Role.CUSTOMER })
    const code = await getCode(ticket.id, ownerToken)

    const CONCURRENCY = 10
    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        supertest(app)
          .post('/api/v1/gate/validate')
          .set('Authorization', `Bearer ${gateToken}`)
          .send({ code, eventId: event.id }),
      ),
    )

    const valid = results.filter((r) => r.body.result === 'VALID')
    const alreadyUsed = results.filter((r) => r.body.result === 'ALREADY_USED')
    expect(valid).toHaveLength(1)
    expect(alreadyUsed).toHaveLength(CONCURRENCY - 1)
    results.forEach((r) => expect(r.status).toBe(200))
  })
})

describe('GET /api/v1/gate/events/:id/stats', () => {
  beforeEach(cleanDatabase)

  it('total/used/remaining refletem o banco', async () => {
    const { event, ticket, gateToken } = await issueTicket()
    const customer = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id }, include: { order: true } })
    const ownerToken = signAccessToken({ sub: customer.order.userId, role: Role.CUSTOMER })
    const code = await getCode(ticket.id, ownerToken)

    await supertest(app)
      .post('/api/v1/gate/validate')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ code, eventId: event.id })

    const res = await supertest(app)
      .get(`/api/v1/gate/events/${event.id}/stats`)
      .set('Authorization', `Bearer ${gateToken}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ total: 1, used: 1, remaining: 0 })
    expect(res.body.lastValidations.length).toBeGreaterThan(0)
  })
})
