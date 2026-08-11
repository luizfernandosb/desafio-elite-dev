import supertest from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { app } from '../../app'
import { Role } from '../../../generated/prisma/enums'
import { prisma } from '../../lib/prisma'
import { signAccessToken } from '../auth/token.service'
import { cleanDatabase } from '../../test/setup'
import { server } from '../../test/msw/server'

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Event.organizerId tem FK real para User -- diferente de auth/catalog, um token
// assinado para um `sub` inexistente quebra com violação de FK na hora do INSERT.
// Cria o usuário de verdade e assina o token para o id dele.
async function createUserAndToken(role: Role, emailPrefix: string) {
  const user = await prisma.user.create({
    data: { email: `${emailPrefix}-${crypto.randomUUID()}@test.com`, name: `Teste ${role}`, role },
  })
  return { user, token: signAccessToken({ sub: user.id, role }) }
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    source: 'TMDB',
    externalId: '603',
    venueName: 'Cine Belas Artes',
    venueCity: 'São Paulo',
    startsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    timezone: 'America/Sao_Paulo',
    priceInCents: 3200,
    layout: { rows: 8, seatsPerRow: 12 },
    ...overrides,
  }
}

async function createEvent(token: string, overrides: Record<string, unknown> = {}) {
  return supertest(app)
    .post('/api/v1/events')
    .set('Authorization', `Bearer ${token}`)
    .send(validPayload(overrides))
}

describe('POST /api/v1/events', () => {
  beforeEach(cleanDatabase)

  it('201 -- organizador cria evento com layout 8x12: 96 Seat + 96 SeatState FREE numa transação', async () => {
    const { token } = await createUserAndToken(Role.ORGANIZER, 'org')
    const res = await createEvent(token)

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ status: 'DRAFT', title: 'The Matrix', priceInCents: 3200 })

    const seats = await prisma.seat.findMany({ where: { eventId: res.body.id } })
    const states = await prisma.seatState.findMany({ where: { eventId: res.body.id } })
    expect(seats).toHaveLength(96)
    expect(states).toHaveLength(96)
    expect(states.every((s) => s.status === 'FREE')).toBe(true)
  })

  it('grava startsAt com offset como UTC e devolve junto com o timezone', async () => {
    const { token } = await createUserAndToken(Role.ORGANIZER, 'org')
    const future = new Date(Date.now() + 30 * 86_400_000)
    const dateStr = future.toISOString().slice(0, 10)
    const startsAtWithOffset = `${dateStr}T21:00:00-03:00`

    const res = await createEvent(token, { startsAt: startsAtWithOffset })

    expect(res.status).toBe(201)
    expect(res.body.startsAt).toBe(new Date(startsAtWithOffset).toISOString())
    expect(res.body.timezone).toBe('America/Sao_Paulo')
  })

  it('403 -- cliente não pode criar evento', async () => {
    const { token } = await createUserAndToken(Role.CUSTOMER, 'customer')
    const res = await createEvent(token)
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('FORBIDDEN')
  })

  it('403 -- portaria não pode criar evento', async () => {
    const { token } = await createUserAndToken(Role.GATE, 'gate')
    const res = await createEvent(token)
    expect(res.status).toBe(403)
  })

  it('401 -- sem token', async () => {
    const res = await supertest(app).post('/api/v1/events').send(validPayload())
    expect(res.status).toBe(401)
  })

  it('400 -- priceInCents negativo', async () => {
    const { token } = await createUserAndToken(Role.ORGANIZER, 'org')
    const res = await createEvent(token, { priceInCents: -100 })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })

  it('400 -- timezone inválido (não-IANA)', async () => {
    const { token } = await createUserAndToken(Role.ORGANIZER, 'org')
    const res = await createEvent(token, { timezone: 'GMT-3' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })

  it('400 -- layout acima do teto (rows: 27)', async () => {
    const { token } = await createUserAndToken(Role.ORGANIZER, 'org')
    const res = await createEvent(token, { layout: { rows: 27, seatsPerRow: 10 } })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/v1/events', () => {
  beforeEach(cleanDatabase)

  it('público não recebe nenhum DRAFT', async () => {
    const { token } = await createUserAndToken(Role.ORGANIZER, 'org')
    await createEvent(token)

    const res = await supertest(app).get('/api/v1/events')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
  })

  it('organizador vê os próprios DRAFT via status=DRAFT, mas não os de outro organizador', async () => {
    const org1 = await createUserAndToken(Role.ORGANIZER, 'org1')
    const org2 = await createUserAndToken(Role.ORGANIZER, 'org2')
    await createEvent(org1.token)
    await createEvent(org2.token)

    const res = await supertest(app)
      .get('/api/v1/events?status=DRAFT')
      .set('Authorization', `Bearer ${org1.token}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })

  it('403 -- cliente pedindo status=DRAFT', async () => {
    const { token } = await createUserAndToken(Role.CUSTOMER, 'customer')
    const res = await supertest(app)
      .get('/api/v1/events?status=DRAFT')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })

  it('meta.total reflete o count do banco, não o tamanho da página', async () => {
    const { token } = await createUserAndToken(Role.ORGANIZER, 'org')
    for (let i = 0; i < 25; i++) {
      const created = await createEvent(token, { layout: { rows: 1, seatsPerRow: 1 } })
      await supertest(app).post(`/api/v1/events/${created.body.id}/publish`).set('Authorization', `Bearer ${token}`)
    }

    const res = await supertest(app).get('/api/v1/events?limit=20')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(20)
    expect(res.body.meta).toMatchObject({ total: 25, totalPages: 2, hasNext: true, hasPrev: false })
  })
})

describe('GET /api/v1/events/:id e /seatmap -- visibilidade', () => {
  beforeEach(cleanDatabase)

  it('404 para DRAFT quando o requisitante não é o dono', async () => {
    const org1 = await createUserAndToken(Role.ORGANIZER, 'org1')
    const org2 = await createUserAndToken(Role.ORGANIZER, 'org2')
    const created = await createEvent(org1.token)

    const asPublic = await supertest(app).get(`/api/v1/events/${created.body.id}`)
    expect(asPublic.status).toBe(404)

    const asOther = await supertest(app)
      .get(`/api/v1/events/${created.body.id}`)
      .set('Authorization', `Bearer ${org2.token}`)
    expect(asOther.status).toBe(404)
  })

  it('200 -- seatmap de evento PUBLISHED é público e não expõe userId', async () => {
    const { token } = await createUserAndToken(Role.ORGANIZER, 'org')
    const created = await createEvent(token, { layout: { rows: 2, seatsPerRow: 2 } })
    await supertest(app).post(`/api/v1/events/${created.body.id}/publish`).set('Authorization', `Bearer ${token}`)

    const res = await supertest(app).get(`/api/v1/events/${created.body.id}/seatmap`)
    expect(res.status).toBe(200)
    expect(res.body.rows).toHaveLength(2)
    expect(res.body.rows[0].seats).toHaveLength(2)
    expect(JSON.stringify(res.body)).not.toContain('userId')
  })
})

describe('PATCH /api/v1/events/:id', () => {
  beforeEach(cleanDatabase)

  it('403 -- organizador que não é dono não pode editar', async () => {
    const org1 = await createUserAndToken(Role.ORGANIZER, 'org1')
    const org2 = await createUserAndToken(Role.ORGANIZER, 'org2')
    const created = await createEvent(org1.token)

    const res = await supertest(app)
      .patch(`/api/v1/events/${created.body.id}`)
      .set('Authorization', `Bearer ${org2.token}`)
      .send({ synopsis: 'Tentativa' })

    expect(res.status).toBe(403)
  })

  it('409 EVENT_HAS_SALES -- priceInCents bloqueado depois da primeira venda', async () => {
    const { token } = await createUserAndToken(Role.ORGANIZER, 'org')
    const created = await createEvent(token, { layout: { rows: 1, seatsPerRow: 1 } })
    await supertest(app).post(`/api/v1/events/${created.body.id}/publish`).set('Authorization', `Bearer ${token}`)

    await simulateSale(created.body.id)

    const res = await supertest(app)
      .patch(`/api/v1/events/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ priceInCents: 9999 })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('EVENT_HAS_SALES')
  })

  it('200 -- synopsis continua editável mesmo com venda', async () => {
    const { token } = await createUserAndToken(Role.ORGANIZER, 'org')
    const created = await createEvent(token, { layout: { rows: 1, seatsPerRow: 1 } })
    await supertest(app).post(`/api/v1/events/${created.body.id}/publish`).set('Authorization', `Bearer ${token}`)
    await simulateSale(created.body.id)

    const res = await supertest(app)
      .patch(`/api/v1/events/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ synopsis: 'Sinopse atualizada' })

    expect(res.status).toBe(200)
    expect(res.body.synopsis).toBe('Sinopse atualizada')
  })
})

describe('DELETE /api/v1/events/:id', () => {
  beforeEach(cleanDatabase)

  it('204 -- remove um DRAFT sem vendas', async () => {
    const { token } = await createUserAndToken(Role.ORGANIZER, 'org')
    const created = await createEvent(token)

    const res = await supertest(app)
      .delete(`/api/v1/events/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(204)
  })

  it('409 -- evento PUBLISHED não pode ser removido', async () => {
    const { token } = await createUserAndToken(Role.ORGANIZER, 'org')
    const created = await createEvent(token, { layout: { rows: 1, seatsPerRow: 1 } })
    await supertest(app).post(`/api/v1/events/${created.body.id}/publish`).set('Authorization', `Bearer ${token}`)

    const res = await supertest(app)
      .delete(`/api/v1/events/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(409)
  })
})

describe('POST /api/v1/events/:id/publish e /cancel', () => {
  beforeEach(cleanDatabase)

  it('publica um DRAFT e depois cancela', async () => {
    const { token } = await createUserAndToken(Role.ORGANIZER, 'org')
    const created = await createEvent(token)

    const published = await supertest(app)
      .post(`/api/v1/events/${created.body.id}/publish`)
      .set('Authorization', `Bearer ${token}`)
    expect(published.status).toBe(200)
    expect(published.body.status).toBe('PUBLISHED')

    const cancelled = await supertest(app)
      .post(`/api/v1/events/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
    expect(cancelled.status).toBe(200)
    expect(cancelled.body.status).toBe('CANCELLED')
  })

  it('422 -- não é possível publicar um evento já cancelado', async () => {
    const { token } = await createUserAndToken(Role.ORGANIZER, 'org')
    const created = await createEvent(token)
    await supertest(app).post(`/api/v1/events/${created.body.id}/cancel`).set('Authorization', `Bearer ${token}`)

    const res = await supertest(app)
      .post(`/api/v1/events/${created.body.id}/publish`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('INVALID_TRANSITION')
  })
})

// insere Order + Ticket direto no banco -- simula "há venda" sem depender do módulo
// de pedidos (etapa 07, ainda não implementado)
async function simulateSale(eventId: string) {
  const customer = await prisma.user.create({
    data: { email: `comprador-${crypto.randomUUID()}@test.com`, name: 'Comprador' },
  })
  const seat = await prisma.seat.findFirstOrThrow({ where: { eventId } })
  const order = await prisma.order.create({
    data: {
      userId: customer.id,
      eventId,
      amountInCents: 3200,
      expiresAt: new Date(Date.now() + 30 * 60_000),
    },
  })
  await prisma.ticket.create({
    data: { orderId: order.id, eventId, seatId: seat.id, codeHash: `hash-${crypto.randomUUID()}` },
  })
}
