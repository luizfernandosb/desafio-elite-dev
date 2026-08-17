import supertest from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { app } from '../../app'
import { prisma } from '../../lib/prisma'
import { Role } from '../../../generated/prisma/enums'
import { signAccessToken } from '../auth/token.service'
import { cleanDatabase } from '../../test/setup'
import { seedPaidTicket, seedUser } from '../../test/factories'
import { generateTicketCode } from '../tickets/qr.service'

async function issueTicket() {
  const paid = await seedPaidTicket({ startsAt: new Date(Date.now() - 30 * 60_000) })
  const gate = await seedUser(Role.GATE)
  const gateToken = signAccessToken({ sub: gate.id, role: Role.GATE })
  return { ...paid, gateToken }
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

    expect(first.status).toBe(200)
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
    const other = await issueTicket()
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
