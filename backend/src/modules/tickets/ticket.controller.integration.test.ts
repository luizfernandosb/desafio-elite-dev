import supertest from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { app } from '../../app'
import { prisma } from '../../lib/prisma'
import { Role } from '../../../generated/prisma/enums'
import { signAccessToken } from '../auth/token.service'
import { cleanDatabase } from '../../test/setup'
import { seedPaidTicket, seedUser } from '../../test/factories'
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
