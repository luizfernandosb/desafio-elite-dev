import supertest from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { app } from '../../app'
import { Role } from '../../../generated/prisma/enums'
import { signAccessToken } from '../auth/token.service'
import { cleanDatabase } from '../../test/setup'
import { server } from '../../test/msw/server'

// 'bypass', não 'error': este arquivo mistura supertest (loopback local, precisa
// passar sem ser interceptado) com o mock do TMDb (precisa ser interceptado) --
// ver comentário em test/msw/server.ts
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function tokenFor(role: Role) {
  return signAccessToken({ sub: `user-${role}`, role })
}

describe('GET /api/v1/catalog/search', () => {
  beforeEach(cleanDatabase)

  it('200 -- organizador busca e recebe resultados normalizados paginados', async () => {
    const res = await supertest(app)
      .get('/api/v1/catalog/search?q=matrix')
      .set('Authorization', `Bearer ${tokenFor(Role.ORGANIZER)}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([
      expect.objectContaining({
        title: 'The Matrix',
        imageUrl: 'https://image.tmdb.org/t/p/w500/matrix.jpg',
      }),
    ])
    expect(res.body.meta).toMatchObject({ page: 1, total: 1 })
  })

  it('403 -- cliente não pode buscar no catálogo', async () => {
    const res = await supertest(app)
      .get('/api/v1/catalog/search?q=matrix')
      .set('Authorization', `Bearer ${tokenFor(Role.CUSTOMER)}`)
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('FORBIDDEN')
  })

  it('403 -- portaria não pode buscar no catálogo', async () => {
    const res = await supertest(app)
      .get('/api/v1/catalog/search?q=matrix')
      .set('Authorization', `Bearer ${tokenFor(Role.GATE)}`)
    expect(res.status).toBe(403)
  })

  it('401 -- sem token', async () => {
    const res = await supertest(app).get('/api/v1/catalog/search?q=matrix')
    expect(res.status).toBe(401)
  })

  it('400 -- q vazio', async () => {
    const res = await supertest(app)
      .get('/api/v1/catalog/search?q=a')
      .set('Authorization', `Bearer ${tokenFor(Role.ORGANIZER)}`)
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })

  it('segunda busca idêntica usa cache -- não bate no TMDb de novo', async () => {
    const authHeader = `Bearer ${tokenFor(Role.ORGANIZER)}`

    const first = await supertest(app).get('/api/v1/catalog/search?q=matrix').set('Authorization', authHeader)
    expect(first.status).toBe(200)

    // handler removido -- se a segunda busca tentasse ir à rede, cairia no
    // 'bypass' e voltaria vazio (sem handler == sem mock == sem resposta simulada)
    server.resetHandlers()

    const second = await supertest(app).get('/api/v1/catalog/search?q=matrix').set('Authorization', authHeader)
    expect(second.status).toBe(200)
    expect(second.body.data).toEqual(first.body.data)
  })
})

describe('GET /api/v1/catalog/:source/:externalId', () => {
  beforeEach(cleanDatabase)

  it('200 -- organizador busca o detalhe do filme', async () => {
    const res = await supertest(app)
      .get('/api/v1/catalog/TMDB/603')
      .set('Authorization', `Bearer ${tokenFor(Role.ORGANIZER)}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ title: 'The Matrix', runtimeMinutes: 136 })
  })

  it('404 -- filme inexistente no TMDb', async () => {
    const res = await supertest(app)
      .get('/api/v1/catalog/TMDB/id-que-nao-existe')
      .set('Authorization', `Bearer ${tokenFor(Role.ORGANIZER)}`)
    expect(res.status).toBe(404)
  })

  it('400 -- source fora do enum', async () => {
    const res = await supertest(app)
      .get('/api/v1/catalog/TICKETMASTER/603')
      .set('Authorization', `Bearer ${tokenFor(Role.ORGANIZER)}`)
    expect(res.status).toBe(400)
  })
})
