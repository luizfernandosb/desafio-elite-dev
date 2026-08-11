import supertest from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { app } from '../../app'
import { EventStatus, Role } from '../../../generated/prisma/enums'
import { signAccessToken } from '../auth/token.service'
import { cleanDatabase } from '../../test/setup'
import { seedEventWithSeats, seedUser } from '../../test/factories'

async function tokenForNewUser(role: Role) {
  const user = await seedUser(role)
  return { user, token: signAccessToken({ sub: user.id, role }) }
}

describe('POST /api/v1/events/:id/holds', () => {
  beforeEach(cleanDatabase)

  it('201 -- cliente reserva um assento livre', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 5 })
    const { token } = await tokenForNewUser(Role.CUSTOMER)

    const res = await supertest(app)
      .post(`/api/v1/events/${event.id}/holds`)
      .set('Authorization', `Bearer ${token}`)
      .send({ seatIds: [seats[0]!.id] })

    expect(res.status).toBe(201)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0]).toMatchObject({ seatId: seats[0]!.id })
  })

  it('403 -- organizador não pode reservar assento', async () => {
    const { event, seats } = await seedEventWithSeats()
    const { token } = await tokenForNewUser(Role.ORGANIZER)

    const res = await supertest(app)
      .post(`/api/v1/events/${event.id}/holds`)
      .set('Authorization', `Bearer ${token}`)
      .send({ seatIds: [seats[0]!.id] })

    expect(res.status).toBe(403)
  })

  it('403 -- portaria não pode reservar assento', async () => {
    const { event, seats } = await seedEventWithSeats()
    const { token } = await tokenForNewUser(Role.GATE)

    const res = await supertest(app)
      .post(`/api/v1/events/${event.id}/holds`)
      .set('Authorization', `Bearer ${token}`)
      .send({ seatIds: [seats[0]!.id] })

    expect(res.status).toBe(403)
  })

  it('401 -- sem token', async () => {
    const { event, seats } = await seedEventWithSeats()
    const res = await supertest(app)
      .post(`/api/v1/events/${event.id}/holds`)
      .send({ seatIds: [seats[0]!.id] })
    expect(res.status).toBe(401)
  })

  it('404 -- evento inexistente', async () => {
    const { token } = await tokenForNewUser(Role.CUSTOMER)
    const res = await supertest(app)
      .post('/api/v1/events/id-que-nao-existe/holds')
      .set('Authorization', `Bearer ${token}`)
      .send({ seatIds: ['seat-1'] })
    expect(res.status).toBe(404)
  })

  it('409 EVENT_NOT_PUBLISHED -- evento ainda é DRAFT', async () => {
    const { event, seats } = await seedEventWithSeats({ status: EventStatus.DRAFT })
    const { token } = await tokenForNewUser(Role.CUSTOMER)

    const res = await supertest(app)
      .post(`/api/v1/events/${event.id}/holds`)
      .set('Authorization', `Bearer ${token}`)
      .send({ seatIds: [seats[0]!.id] })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('EVENT_NOT_PUBLISHED')
  })

  it('422 -- assento pertence a outro evento', async () => {
    const { event: eventA } = await seedEventWithSeats({ seatCount: 1 })
    const { seats: seatsB } = await seedEventWithSeats({ seatCount: 1 })
    const { token } = await tokenForNewUser(Role.CUSTOMER)

    const res = await supertest(app)
      .post(`/api/v1/events/${eventA.id}/holds`)
      .set('Authorization', `Bearer ${token}`)
      .send({ seatIds: [seatsB[0]!.id] })

    expect(res.status).toBe(422)
    expect(res.body.code).toBe('SEAT_NOT_IN_EVENT')
  })

  it('400 -- mais de 6 assentos numa única requisição', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 8 })
    const { token } = await tokenForNewUser(Role.CUSTOMER)

    const res = await supertest(app)
      .post(`/api/v1/events/${event.id}/holds`)
      .set('Authorization', `Bearer ${token}`)
      .send({ seatIds: seats.slice(0, 7).map((s) => s.id) })

    expect(res.status).toBe(400)
  })

  it('409 SEAT_TAKEN com takenSeatIds -- assento já reservado por outro cliente', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 1 })
    const first = await tokenForNewUser(Role.CUSTOMER)
    const second = await tokenForNewUser(Role.CUSTOMER)

    const firstRes = await supertest(app)
      .post(`/api/v1/events/${event.id}/holds`)
      .set('Authorization', `Bearer ${first.token}`)
      .send({ seatIds: [seats[0]!.id] })
    expect(firstRes.status).toBe(201)

    const secondRes = await supertest(app)
      .post(`/api/v1/events/${event.id}/holds`)
      .set('Authorization', `Bearer ${second.token}`)
      .send({ seatIds: [seats[0]!.id] })

    expect(secondRes.status).toBe(409)
    expect(secondRes.body.code).toBe('SEAT_TAKEN')
    expect(secondRes.body.takenSeatIds).toEqual([seats[0]!.id])
  })

  it('409 HOLD_LIMIT_EXCEEDED -- teto de 6 assentos por usuário/evento', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 7 })
    const { token } = await tokenForNewUser(Role.CUSTOMER)

    const first = await supertest(app)
      .post(`/api/v1/events/${event.id}/holds`)
      .set('Authorization', `Bearer ${token}`)
      .send({ seatIds: seats.slice(0, 6).map((s) => s.id) })
    expect(first.status).toBe(201)

    const second = await supertest(app)
      .post(`/api/v1/events/${event.id}/holds`)
      .set('Authorization', `Bearer ${token}`)
      .send({ seatIds: [seats[6]!.id] })

    expect(second.status).toBe(409)
    expect(second.body.code).toBe('HOLD_LIMIT_EXCEEDED')
  })
})

describe('DELETE /api/v1/events/:eventId/holds/:holdId', () => {
  beforeEach(cleanDatabase)

  it('204 -- dono libera o próprio hold, e o assento volta a FREE no seatmap', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 1 })
    const { token } = await tokenForNewUser(Role.CUSTOMER)

    const created = await supertest(app)
      .post(`/api/v1/events/${event.id}/holds`)
      .set('Authorization', `Bearer ${token}`)
      .send({ seatIds: [seats[0]!.id] })
    const holdId = created.body.data[0].id

    const res = await supertest(app)
      .delete(`/api/v1/events/${event.id}/holds/${holdId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(204)

    const seatmap = await supertest(app).get(`/api/v1/events/${event.id}/seatmap`)
    expect(seatmap.body.rows[0].seats[0].status).toBe('FREE')
  })

  it('204 -- liberar hold já liberado é idempotente, não é erro', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 1 })
    const { token } = await tokenForNewUser(Role.CUSTOMER)

    const created = await supertest(app)
      .post(`/api/v1/events/${event.id}/holds`)
      .set('Authorization', `Bearer ${token}`)
      .send({ seatIds: [seats[0]!.id] })
    const holdId = created.body.data[0].id

    await supertest(app).delete(`/api/v1/events/${event.id}/holds/${holdId}`).set('Authorization', `Bearer ${token}`)
    const res = await supertest(app)
      .delete(`/api/v1/events/${event.id}/holds/${holdId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(204)
  })

  it('404 -- outro cliente não pode liberar o hold (privado, não revela)', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 1 })
    const owner = await tokenForNewUser(Role.CUSTOMER)
    const other = await tokenForNewUser(Role.CUSTOMER)

    const created = await supertest(app)
      .post(`/api/v1/events/${event.id}/holds`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ seatIds: [seats[0]!.id] })
    const holdId = created.body.data[0].id

    const res = await supertest(app)
      .delete(`/api/v1/events/${event.id}/holds/${holdId}`)
      .set('Authorization', `Bearer ${other.token}`)

    expect(res.status).toBe(404)
  })
})

describe('GET /api/v1/events/:id/holds/mine', () => {
  beforeEach(cleanDatabase)

  it('lista só os holds ativos do próprio usuário', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 2 })
    const mine = await tokenForNewUser(Role.CUSTOMER)
    const other = await tokenForNewUser(Role.CUSTOMER)

    await supertest(app)
      .post(`/api/v1/events/${event.id}/holds`)
      .set('Authorization', `Bearer ${mine.token}`)
      .send({ seatIds: [seats[0]!.id] })
    await supertest(app)
      .post(`/api/v1/events/${event.id}/holds`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ seatIds: [seats[1]!.id] })

    const res = await supertest(app)
      .get(`/api/v1/events/${event.id}/holds/mine`)
      .set('Authorization', `Bearer ${mine.token}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].seatId).toBe(seats[0]!.id)
  })
})
