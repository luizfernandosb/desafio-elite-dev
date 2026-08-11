import { describe, expect, it } from 'vitest'
import supertest from 'supertest'
import { app } from './app'

describe('app', () => {
  it('GET /health responde 200 com status ok e db up', async () => {
    const response = await supertest(app).get('/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok', db: 'up' })
    expect(response.headers['x-request-id']).toBeDefined()
  })

  it('rota inexistente responde 404 com { code, message }', async () => {
    const response = await supertest(app).get('/rota-que-nao-existe')

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ code: 'NOT_FOUND', message: expect.any(String) })
  })
})
