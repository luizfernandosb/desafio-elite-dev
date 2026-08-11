import supertest from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { app } from '../../app'
import { cleanDatabase } from '../../test/setup'

function findRawRefreshCookie(res: { headers: Record<string, unknown> }): string {
  const setCookie = res.headers['set-cookie'] as unknown as string[]
  const cookie = setCookie?.find((c) => c.startsWith('refreshToken='))
  if (!cookie) throw new Error('refreshToken cookie ausente na resposta')
  return cookie
}

// nome=valor, sem os atributos -- é o formato que o header `Cookie` de uma requisição espera
function extractRefreshCookie(res: { headers: Record<string, unknown> }): string {
  return findRawRefreshCookie(res).split(';')[0] as string
}

const VALID_PASSWORD = 'senha-bem-forte-123'

async function registerUser(email = 'user@example.com') {
  const res = await supertest(app)
    .post('/api/v1/auth/register')
    .send({ name: 'Usuário Teste', email, password: VALID_PASSWORD })
  return res
}

describe('POST /api/v1/auth/register', () => {
  beforeEach(cleanDatabase)

  it('201 -- cria conta CUSTOMER com dados válidos', async () => {
    const res = await registerUser()
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      accessToken: expect.any(String),
      user: { role: 'CUSTOMER', email: 'user@example.com' },
    })
    expect(findRawRefreshCookie(res)).toContain('HttpOnly')
  })

  it('ignora o campo role no corpo e cria CUSTOMER mesmo assim', async () => {
    const res = await supertest(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Tentativa', email: 'tentativa@example.com', password: VALID_PASSWORD, role: 'ORGANIZER' })
    expect(res.status).toBe(201)
    expect(res.body.user.role).toBe('CUSTOMER')
  })

  it('409 -- e-mail já cadastrado', async () => {
    await registerUser()
    const res = await registerUser()
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('EMAIL_TAKEN')
  })

  it('400 -- senha curta demais', async () => {
    const res = await supertest(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Usuário', email: 'curta@example.com', password: 'curta' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })

  it('400 -- e-mail malformado', async () => {
    const res = await supertest(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Usuário', email: 'nao-e-email', password: VALID_PASSWORD })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })
})

describe('POST /api/v1/auth/login', () => {
  beforeEach(cleanDatabase)

  it('200 -- credenciais corretas', async () => {
    await registerUser()
    const res = await supertest(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user@example.com', password: VALID_PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ accessToken: expect.any(String), user: { role: 'CUSTOMER' } })
  })

  it('e-mail inexistente e senha errada produzem resposta idêntica', async () => {
    await registerUser()

    const wrongPassword = await supertest(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user@example.com', password: 'senha-errada-mesmo' })

    const noSuchEmail = await supertest(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ninguem-aqui@example.com', password: 'senha-errada-mesmo' })

    expect(wrongPassword.status).toBe(401)
    expect(noSuchEmail.status).toBe(401)
    expect(wrongPassword.body).toEqual(noSuchEmail.body)
  })

  it('401 -- sem token em rota protegida (/me)', async () => {
    const res = await supertest(app).get('/api/v1/auth/me')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/v1/auth/me', () => {
  beforeEach(cleanDatabase)

  it('200 -- devolve o usuário do token', async () => {
    const registered = await registerUser()
    const res = await supertest(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registered.body.accessToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ email: 'user@example.com', role: 'CUSTOMER' })
    expect(res.body.passwordHash).toBeUndefined()
  })
})

describe('POST /api/v1/auth/refresh -- rotação e reuso', () => {
  beforeEach(cleanDatabase)

  it('rotaciona o refresh token a cada uso e detecta reuso', async () => {
    const registered = await registerUser()
    const firstCookie = extractRefreshCookie(registered)

    const refreshed = await supertest(app).post('/api/v1/auth/refresh').set('Cookie', firstCookie)
    expect(refreshed.status).toBe(200)
    expect(refreshed.body.accessToken).toBeDefined()
    const secondCookie = extractRefreshCookie(refreshed)
    expect(secondCookie).not.toBe(firstCookie)

    // reapresentar o cookie já usado (rotacionado) é reuso -- 401 e revoga a família inteira
    const reused = await supertest(app).post('/api/v1/auth/refresh').set('Cookie', firstCookie)
    expect(reused.status).toBe(401)

    // a família inteira foi revogada -- até o cookie novo (ainda não usado) para de funcionar
    const afterFamilyRevoked = await supertest(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', secondCookie)
    expect(afterFamilyRevoked.status).toBe(401)
  })

  it('401 -- refresh sem cookie', async () => {
    const res = await supertest(app).post('/api/v1/auth/refresh')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/v1/auth/logout', () => {
  beforeEach(cleanDatabase)

  it('204 e revoga o refresh -- uso posterior falha', async () => {
    const registered = await registerUser()
    const cookie = extractRefreshCookie(registered)

    const logoutRes = await supertest(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${registered.body.accessToken}`)
      .set('Cookie', cookie)
    expect(logoutRes.status).toBe(204)

    const afterLogout = await supertest(app).post('/api/v1/auth/refresh').set('Cookie', cookie)
    expect(afterLogout.status).toBe(401)
  })

  it('401 -- logout sem token de acesso', async () => {
    const res = await supertest(app).post('/api/v1/auth/logout')
    expect(res.status).toBe(401)
  })
})
