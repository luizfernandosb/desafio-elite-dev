import { randomUUID } from 'node:crypto'
import supertest from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { app } from '../../app'
import { prisma } from '../../lib/prisma'
import { Role } from '../../../generated/prisma/enums'
import { signAccessToken } from '../auth/token.service'
import { cleanDatabase } from '../../test/setup'
import { seedPaidTicket, seedUser, signWebhook } from '../../test/factories'
import { verifyTicketCode } from './qr.service'

function payForSeats(seatCount: number) {
  return seedPaidTicket({ seatCount })
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
    expect(res.body.data[0].priceType).toBe('FULL')
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
    expect(res.body.priceType).toBe('FULL')
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

  it('401 -- sem token', async () => {
    const { orderId } = await payForSeats(1)
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { orderId } })

    const res = await supertest(app).get(`/api/v1/tickets/${ticket.id}`)

    expect(res.status).toBe(401)
  })

  it('403 -- organizador não acessa ingresso por este papel (rota é só CUSTOMER)', async () => {
    const { orderId } = await payForSeats(1)
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { orderId } })
    const organizer = await seedUser(Role.ORGANIZER)
    const organizerToken = signAccessToken({ sub: organizer.id, role: Role.ORGANIZER })

    const res = await supertest(app)
      .get(`/api/v1/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${organizerToken}`)

    expect(res.status).toBe(403)
  })
})

describe('POST /api/v1/tickets/:id/cancel', () => {
  beforeEach(cleanDatabase)

  it('200 -- cancela o ticket, libera o assento; Order continua PAID se sobra outro ticket ativo', async () => {
    const { token, tickets, seats, orderId } = await payForSeats(2)

    const res = await supertest(app)
      .post(`/api/v1/tickets/${tickets[0]!.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('CANCELLED')

    const seatState = await prisma.seatState.findUniqueOrThrow({ where: { seatId: seats[0]!.id } })
    expect(seatState.status).toBe('FREE')

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
    expect(order.status).toBe('PAID') // o outro ticket do pedido ainda está ACTIVE
  })

  it('200 -- cancelar o último ticket ativo do pedido transiciona a Order para REFUNDED', async () => {
    const { token, tickets, orderId } = await payForSeats(1)

    const res = await supertest(app)
      .post(`/api/v1/tickets/${tickets[0]!.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
    expect(order.status).toBe('REFUNDED')
  })

  it('422 -- ticket já cancelado não pode ser cancelado de novo', async () => {
    const { token, tickets } = await payForSeats(1)
    await supertest(app).post(`/api/v1/tickets/${tickets[0]!.id}/cancel`).set('Authorization', `Bearer ${token}`)

    const res = await supertest(app)
      .post(`/api/v1/tickets/${tickets[0]!.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(422)
    expect(res.body.code).toBe('INVALID_TRANSITION')
  })

  it('409 -- sessão já começou, cancelamento é recusado', async () => {
    const { token, tickets } = await seedPaidTicket({ startsAt: new Date(Date.now() - 60 * 60 * 1000) })

    const res = await supertest(app)
      .post(`/api/v1/tickets/${tickets[0]!.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('EVENT_ALREADY_STARTED')
  })

  it('404 -- outro cliente não pode cancelar o ingresso de alguém (privado, não revela)', async () => {
    const { tickets } = await payForSeats(1)
    const other = await seedUser(Role.CUSTOMER)
    const otherToken = signAccessToken({ sub: other.id, role: Role.CUSTOMER })

    const res = await supertest(app)
      .post(`/api/v1/tickets/${tickets[0]!.id}/cancel`)
      .set('Authorization', `Bearer ${otherToken}`)

    expect(res.status).toBe(404)
  })

  it('401 -- sem token', async () => {
    const { tickets } = await payForSeats(1)
    const res = await supertest(app).post(`/api/v1/tickets/${tickets[0]!.id}/cancel`)
    expect(res.status).toBe(401)
  })

  // Regressão do achado que motivou a migration `ticket_seat_unique_excludes_cancelled`:
  // sem o índice corrigido, esta segunda compra do MESMO assento falharia com 500
  // (violação de unique constraint) na hora de emitir o novo ticket em confirmPayment.
  it('assento cancelado pode ser vendido de novo -- migration do índice parcial resolveu o bloqueio', async () => {
    const { token, event, seats, tickets } = await payForSeats(1)
    await supertest(app).post(`/api/v1/tickets/${tickets[0]!.id}/cancel`).set('Authorization', `Bearer ${token}`)

    const otherCustomer = await seedUser(Role.CUSTOMER)
    const otherToken = signAccessToken({ sub: otherCustomer.id, role: Role.CUSTOMER })

    const hold = await prisma.seatHold.create({
      data: {
        eventId: event.id,
        seatId: seats[0]!.id,
        userId: otherCustomer.id,
        expiresAt: new Date(Date.now() + 600_000),
      },
    })
    await prisma.seatState.update({ where: { seatId: seats[0]!.id }, data: { status: 'HELD' } })

    const orderRes = await supertest(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${otherToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({ eventId: event.id, holdIds: [hold.id] })
    expect(orderRes.status).toBe(201)

    const order = orderRes.body.order as { id: string; stripePaymentIntentId: string }
    const { payload, signature } = signWebhook('payment_intent.succeeded', order.stripePaymentIntentId)
    const webhookRes = await supertest(app)
      .post('/api/v1/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', signature)
      .send(payload)

    expect(webhookRes.status).toBe(200)
    const newTicket = await prisma.ticket.findFirstOrThrow({ where: { orderId: order.id } })
    expect(newTicket.status).toBe('ACTIVE')
    expect(newTicket.seatId).toBe(seats[0]!.id)
  })
})
