import supertest from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { app } from '../../app'
import { env } from '../../config/env'
import { Role } from '../../../generated/prisma/enums'
import { signAccessToken } from '../auth/token.service'
import { cleanDatabase } from '../../test/setup'
import { seedPaidTicket, seedUser } from '../../test/factories'

// alias local -- as chamadas abaixo já dependiam do nome `issueTicket`, e o formato
// que `seedPaidTicket` devolve ({ event, seat, ticket, token, ... }) já é o que este
// arquivo sempre esperou
const issueTicket = seedPaidTicket

describe('POST /api/v1/tickets/:id/share', () => {
  beforeEach(cleanDatabase)

  it('201 -- dono gera o link, URL absoluta com APP_PUBLIC_URL', async () => {
    const { ticket, token } = await issueTicket()

    const res = await supertest(app)
      .post(`/api/v1/tickets/${ticket.id}/share`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(201)
    expect(res.body.url.startsWith(env.APP_PUBLIC_URL)).toBe(true)
    expect(res.body.expiresAt).toBeDefined()
  })

  it('idempotente -- segundo POST devolve o mesmo token', async () => {
    const { ticket, token } = await issueTicket()

    const first = await supertest(app).post(`/api/v1/tickets/${ticket.id}/share`).set('Authorization', `Bearer ${token}`)
    const second = await supertest(app).post(`/api/v1/tickets/${ticket.id}/share`).set('Authorization', `Bearer ${token}`)

    expect(first.body.url).toBe(second.body.url)
  })

  it('404 -- outro cliente não pode gerar link do ingresso de A', async () => {
    const { ticket } = await issueTicket()
    const other = await seedUser(Role.CUSTOMER)
    const otherToken = signAccessToken({ sub: other.id, role: Role.CUSTOMER })

    const res = await supertest(app)
      .post(`/api/v1/tickets/${ticket.id}/share`)
      .set('Authorization', `Bearer ${otherToken}`)

    expect(res.status).toBe(404)
  })

  it('401 -- sem token', async () => {
    const { ticket } = await issueTicket()
    const res = await supertest(app).post(`/api/v1/tickets/${ticket.id}/share`)
    expect(res.status).toBe(401)
  })

  it('403 -- organizador não gera link de compartilhamento (rota é só CUSTOMER)', async () => {
    const { ticket } = await issueTicket()
    const organizer = await seedUser(Role.ORGANIZER)
    const organizerToken = signAccessToken({ sub: organizer.id, role: Role.ORGANIZER })

    const res = await supertest(app)
      .post(`/api/v1/tickets/${ticket.id}/share`)
      .set('Authorization', `Bearer ${organizerToken}`)

    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/v1/tickets/:id/share', () => {
  beforeEach(cleanDatabase)

  it('204, e o link revogado responde 410; um novo POST gera token diferente', async () => {
    const { ticket, token } = await issueTicket()

    const created = await supertest(app).post(`/api/v1/tickets/${ticket.id}/share`).set('Authorization', `Bearer ${token}`)
    const oldToken = created.body.url.split('/').pop()

    const revoked = await supertest(app)
      .delete(`/api/v1/tickets/${ticket.id}/share`)
      .set('Authorization', `Bearer ${token}`)
    expect(revoked.status).toBe(204)

    const afterRevoke = await supertest(app).get(`/api/v1/share/${oldToken}`)
    expect(afterRevoke.status).toBe(410)
    expect(afterRevoke.body.code).toBe('SHARE_REVOKED')

    const recreated = await supertest(app).post(`/api/v1/tickets/${ticket.id}/share`).set('Authorization', `Bearer ${token}`)
    const newToken = recreated.body.url.split('/').pop()
    expect(newToken).not.toBe(oldToken)
  })
})

describe('GET /api/v1/share/:shareToken -- página pública', () => {
  beforeEach(cleanDatabase)

  it('200 -- evento, assento e QR, sem nenhum campo pessoal', async () => {
    const { ticket, token, seat } = await issueTicket()
    const created = await supertest(app).post(`/api/v1/tickets/${ticket.id}/share`).set('Authorization', `Bearer ${token}`)
    const shareToken = created.body.url.split('/').pop()

    const res = await supertest(app).get(`/api/v1/share/${shareToken}`)

    expect(res.status).toBe(200)
    expect(res.body.seat).toEqual({ row: seat.row, number: seat.number })
    expect(typeof res.body.ticket.code).toBe('string')
    expect(res.body.ticket.status).toBe('ACTIVE')
    expect(res.headers['cache-control']).toContain('no-store')
    expect(res.headers['x-robots-tag']).toBe('noindex')

    const serialized = JSON.stringify(res.body)
    for (const forbidden of ['email', 'userId', 'orderId', 'name"']) {
      expect(serialized).not.toContain(forbidden)
    }
  })

  it('404 SHARE_NOT_FOUND -- token inexistente', async () => {
    const res = await supertest(app).get('/api/v1/share/token-que-nao-existe')
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('SHARE_NOT_FOUND')
  })

  // a prova de que o shareToken não aparece em log de verdade é unitária, contra a
  // config real do logger (ver logger.unit.test.ts) -- uma captura de stdout aqui
  // passaria de forma vazia: resposta 200 loga em nível `info`, filtrado pelo
  // LOG_LEVEL=warn do .env.test (mesma armadilha de docs/bugs.md).
})
