import supertest from 'supertest'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { app } from '../../app'
import { Role } from '../../../generated/prisma/enums'
import { signAccessToken } from '../auth/token.service'
import { bypassLoopbackOnly } from '../../test/msw/on-unhandled-request'
import { server } from '../../test/msw/server'

beforeAll(() => server.listen({ onUnhandledRequest: bypassLoopbackOnly }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function tokenFor(role: Role) {
  return signAccessToken({ sub: `user-${role}`, role })
}

describe('GET /api/v1/locations/states', () => {
  it('200 -- organizador recebe a lista de estados', async () => {
    const res = await supertest(app)
      .get('/api/v1/locations/states')
      .set('Authorization', `Bearer ${tokenFor(Role.ORGANIZER)}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ sigla: 'MG', nome: 'Minas Gerais' })]),
    )
  })

  it('403 -- cliente não pode consultar estados', async () => {
    const res = await supertest(app)
      .get('/api/v1/locations/states')
      .set('Authorization', `Bearer ${tokenFor(Role.CUSTOMER)}`)
    expect(res.status).toBe(403)
  })

  it('401 -- sem token', async () => {
    const res = await supertest(app).get('/api/v1/locations/states')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/v1/locations/states/:uf/cities', () => {
  it('200 -- organizador recebe os municípios da UF', async () => {
    const res = await supertest(app)
      .get('/api/v1/locations/states/MG/cities')
      .set('Authorization', `Bearer ${tokenFor(Role.ORGANIZER)}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ nome: 'Juiz de Fora' })]))
  })

  it('400 -- UF fora do enum de estados do Brasil', async () => {
    const res = await supertest(app)
      .get('/api/v1/locations/states/XX/cities')
      .set('Authorization', `Bearer ${tokenFor(Role.ORGANIZER)}`)
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })

  it('403 -- portaria não pode consultar municípios', async () => {
    const res = await supertest(app)
      .get('/api/v1/locations/states/MG/cities')
      .set('Authorization', `Bearer ${tokenFor(Role.GATE)}`)
    expect(res.status).toBe(403)
  })
})
