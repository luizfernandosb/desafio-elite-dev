import supertest from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { app } from '../../app'
import { Role } from '../../../generated/prisma/enums'
import { prisma } from '../../lib/prisma'
import { signAccessToken } from '../auth/token.service'
import { cleanDatabase } from '../../test/setup'
import { seedEventWithSeats, seedUser } from '../../test/factories'
import { JPEG_FIXTURE, PNG_FIXTURE, SVG_FIXTURE, TEXT_FIXTURE } from '../../test/fixtures/images'
import { bypassLoopbackOnly } from '../../test/msw/on-unhandled-request'
import { server } from '../../test/msw/server'
import { removedStorageKeys } from '../../test/msw/storage-handlers'

// bypassLoopbackOnly, não 'bypass' puro: mistura supertest (loopback local) com o mock
// do Supabase Storage (precisa ser interceptado) -- ver test/msw/on-unhandled-request.ts
beforeAll(() => server.listen({ onUnhandledRequest: bypassLoopbackOnly }))
afterEach(() => {
  server.resetHandlers()
  removedStorageKeys.length = 0
})
afterAll(() => server.close())

function tokenFor(user: { id: string }, role: Role) {
  return signAccessToken({ sub: user.id, role })
}

describe('POST /api/v1/events/:id/image', () => {
  beforeEach(cleanDatabase)

  it('200 -- dono envia JPEG válido, imageUrl passa a apontar para o bucket público', async () => {
    const { event, organizer } = await seedEventWithSeats({ seatCount: 1 })
    const token = tokenFor(organizer, Role.ORGANIZER)

    const res = await supertest(app)
      .post(`/api/v1/events/${event.id}/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', JPEG_FIXTURE, 'banner.jpg')

    expect(res.status).toBe(200)
    expect(res.body.imageUrl).toContain('/storage/v1/object/public/event-images/')
    expect(res.body.imageUrl).toMatch(/\.jpg$/)
    expect(res.body.customImageKey).toMatch(/^events\/.+\.jpg$/)
  })

  it('200 -- .png renomeado para .jpg é aceito e servido como PNG (magic bytes vencem a extensão do nome)', async () => {
    const { event, organizer } = await seedEventWithSeats({ seatCount: 1 })
    const token = tokenFor(organizer, Role.ORGANIZER)

    const res = await supertest(app)
      .post(`/api/v1/events/${event.id}/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', PNG_FIXTURE, 'banner.jpg')

    expect(res.status).toBe(200)
    expect(res.body.imageUrl).toMatch(/\.png$/)
  })

  it('400 INVALID_IMAGE -- arquivo .txt renomeado para .png', async () => {
    const { event, organizer } = await seedEventWithSeats({ seatCount: 1 })
    const token = tokenFor(organizer, Role.ORGANIZER)

    const res = await supertest(app)
      .post(`/api/v1/events/${event.id}/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', TEXT_FIXTURE, 'banner.png')

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_IMAGE')
  })

  it('400 INVALID_IMAGE -- SVG rejeitado', async () => {
    const { event, organizer } = await seedEventWithSeats({ seatCount: 1 })
    const token = tokenFor(organizer, Role.ORGANIZER)

    const res = await supertest(app)
      .post(`/api/v1/events/${event.id}/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', SVG_FIXTURE, 'banner.svg')

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_IMAGE')
  })

  it('400 INVALID_IMAGE -- arquivo maior que 5MB', async () => {
    const { event, organizer } = await seedEventWithSeats({ seatCount: 1 })
    const token = tokenFor(organizer, Role.ORGANIZER)
    const oversized = Buffer.alloc(6 * 1024 * 1024, 0xff)

    const res = await supertest(app)
      .post(`/api/v1/events/${event.id}/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', oversized, 'banner.jpg')

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_IMAGE')
  })

  it('403 -- organizador não dono do evento', async () => {
    const { event } = await seedEventWithSeats({ seatCount: 1 })
    const other = await seedUser(Role.ORGANIZER)
    const token = tokenFor(other, Role.ORGANIZER)

    const res = await supertest(app)
      .post(`/api/v1/events/${event.id}/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', JPEG_FIXTURE, 'banner.jpg')

    expect(res.status).toBe(403)
  })

  it('403 -- cliente não pode enviar imagem', async () => {
    const { event } = await seedEventWithSeats({ seatCount: 1 })
    const customer = await seedUser(Role.CUSTOMER)
    const token = tokenFor(customer, Role.CUSTOMER)

    const res = await supertest(app)
      .post(`/api/v1/events/${event.id}/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', JPEG_FIXTURE, 'banner.jpg')

    expect(res.status).toBe(403)
  })

  it('401 -- sem token', async () => {
    const { event } = await seedEventWithSeats({ seatCount: 1 })

    const res = await supertest(app)
      .post(`/api/v1/events/${event.id}/image`)
      .attach('image', JPEG_FIXTURE, 'banner.jpg')

    expect(res.status).toBe(401)
  })

  it('trocar a imagem remove a anterior do bucket', async () => {
    const { event, organizer } = await seedEventWithSeats({ seatCount: 1 })
    const token = tokenFor(organizer, Role.ORGANIZER)

    const first = await supertest(app)
      .post(`/api/v1/events/${event.id}/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', JPEG_FIXTURE, 'banner.jpg')
    const firstKey = first.body.customImageKey as string

    await supertest(app)
      .post(`/api/v1/events/${event.id}/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', PNG_FIXTURE, 'banner.png')

    expect(removedStorageKeys).toContain(firstKey)
  })
})

describe('DELETE /api/v1/events/:id/image', () => {
  beforeEach(cleanDatabase)

  it('volta ao pôster do catálogo, nunca deixa o evento sem imagem', async () => {
    const { event, organizer } = await seedEventWithSeats({ seatCount: 1 })
    await prisma.event.update({
      where: { id: event.id },
      data: { imageUrl: 'https://tmdb.example/poster.jpg', catalogImageUrl: 'https://tmdb.example/poster.jpg' },
    })
    const token = tokenFor(organizer, Role.ORGANIZER)

    await supertest(app)
      .post(`/api/v1/events/${event.id}/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', JPEG_FIXTURE, 'banner.jpg')

    const res = await supertest(app).delete(`/api/v1/events/${event.id}/image`).set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.imageUrl).toBe('https://tmdb.example/poster.jpg')
    expect(res.body.customImageKey).toBeNull()
  })

  it('idempotente -- remover quando já está no pôster do catálogo não é erro', async () => {
    const { event, organizer } = await seedEventWithSeats({ seatCount: 1 })
    const token = tokenFor(organizer, Role.ORGANIZER)

    const res = await supertest(app).delete(`/api/v1/events/${event.id}/image`).set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
  })

  it('403 -- organizador não dono', async () => {
    const { event } = await seedEventWithSeats({ seatCount: 1 })
    const other = await seedUser(Role.ORGANIZER)
    const token = tokenFor(other, Role.ORGANIZER)

    const res = await supertest(app).delete(`/api/v1/events/${event.id}/image`).set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
  })

  it('401 -- sem token', async () => {
    const { event } = await seedEventWithSeats({ seatCount: 1 })
    const res = await supertest(app).delete(`/api/v1/events/${event.id}/image`)
    expect(res.status).toBe(401)
  })
})
