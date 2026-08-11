import { randomUUID } from 'node:crypto'
import supertest from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { app } from '../../app'
import { Role } from '../../../generated/prisma/enums'
import { prisma } from '../../lib/prisma'
import { signAccessToken } from '../auth/token.service'
import { cleanDatabase } from '../../test/setup'
import { seedEventWithSeats, seedUser } from '../../test/factories'

async function tokenForNewUser(role: Role) {
  const user = await seedUser(role)
  return { user, token: signAccessToken({ sub: user.id, role }) }
}

async function seedActiveHold(eventId: string, seatId: string, userId: string) {
  const expiresAt = new Date(Date.now() + 10 * 60_000)
  // replica o efeito colateral do endpoint real (POST /holds marca o SeatState HELD
  // na mesma transação) -- criar só o SeatHold deixaria o assento "reservado mas
  // ainda FREE no snapshot", um estado que a aplicação nunca produz de verdade
  await prisma.seatState.update({ where: { seatId }, data: { status: 'HELD', expiresAt } })
  return prisma.seatHold.create({
    data: { eventId, seatId, userId, expiresAt },
  })
}

describe('POST /api/v1/orders', () => {
  beforeEach(cleanDatabase)

  it('201 -- cria o pedido com o preço do evento, ignorando qualquer valor do corpo', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 2 })
    const { user, token } = await tokenForNewUser(Role.CUSTOMER)
    const hold = await seedActiveHold(event.id, seats[0]!.id, user.id)

    const res = await supertest(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', randomUUID())
      .send({ eventId: event.id, holdIds: [hold.id], amountInCents: 1 }) // 1 -- deve ser ignorado

    expect(res.status).toBe(201)
    expect(res.body.order.amountInCents).toBe(event.priceInCents)
    expect(res.body.clientSecret).toBeDefined()
  })

  it('400 -- falta o header Idempotency-Key', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 1 })
    const { user, token } = await tokenForNewUser(Role.CUSTOMER)
    const hold = await seedActiveHold(event.id, seats[0]!.id, user.id)

    const res = await supertest(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventId: event.id, holdIds: [hold.id] })

    expect(res.status).toBe(400)
  })

  it('mesma Idempotency-Key duas vezes -- um único pedido', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 1 })
    const { user, token } = await tokenForNewUser(Role.CUSTOMER)
    const hold = await seedActiveHold(event.id, seats[0]!.id, user.id)
    const idempotencyKey = randomUUID()

    const first = await supertest(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ eventId: event.id, holdIds: [hold.id] })

    const second = await supertest(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ eventId: event.id, holdIds: [hold.id] })

    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    expect(second.body.order.id).toBe(first.body.order.id)

    const total = await prisma.order.count({ where: { idempotencyKey } })
    expect(total).toBe(1)
  })

  it('409 HOLD_EXPIRED -- hold não pertence ao usuário', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 1 })
    const owner = await seedUser(Role.CUSTOMER)
    const { token } = await tokenForNewUser(Role.CUSTOMER)
    const hold = await seedActiveHold(event.id, seats[0]!.id, owner.id)

    const res = await supertest(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', randomUUID())
      .send({ eventId: event.id, holdIds: [hold.id] })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('HOLD_EXPIRED')
  })

  it('403 -- organizador não pode criar pedido', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 1 })
    const { token } = await tokenForNewUser(Role.ORGANIZER)

    const res = await supertest(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', randomUUID())
      .send({ eventId: event.id, holdIds: [seats[0]!.id] })

    expect(res.status).toBe(403)
  })

  it('401 -- sem token', async () => {
    const res = await supertest(app)
      .post('/api/v1/orders')
      .set('Idempotency-Key', randomUUID())
      .send({ eventId: 'event-1', holdIds: ['hold-1'] })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/v1/orders/:id', () => {
  beforeEach(cleanDatabase)

  it('200 -- dono lê o próprio pedido', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 1 })
    const { user, token } = await tokenForNewUser(Role.CUSTOMER)
    const hold = await seedActiveHold(event.id, seats[0]!.id, user.id)

    const created = await supertest(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', randomUUID())
      .send({ eventId: event.id, holdIds: [hold.id] })

    const res = await supertest(app)
      .get(`/api/v1/orders/${created.body.order.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(created.body.order.id)
  })

  it('404 -- outro cliente não pode ler o pedido (privado, não revela)', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 1 })
    const owner = await tokenForNewUser(Role.CUSTOMER)
    const other = await tokenForNewUser(Role.CUSTOMER)
    const hold = await seedActiveHold(event.id, seats[0]!.id, owner.user.id)

    const created = await supertest(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${owner.token}`)
      .set('Idempotency-Key', randomUUID())
      .send({ eventId: event.id, holdIds: [hold.id] })

    const res = await supertest(app)
      .get(`/api/v1/orders/${created.body.order.id}`)
      .set('Authorization', `Bearer ${other.token}`)

    expect(res.status).toBe(404)
  })
})
