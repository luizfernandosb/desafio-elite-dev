import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '../test/msw/server'
import { api, ApiError, getAccessToken, onSessionExpired, setAccessToken } from './api'
import { env } from './env'

const API = env.VITE_API_URL

beforeEach(() => {
  setAccessToken('old-token')
})

describe('api -- erro tipado (§5.5.4)', () => {
  it('{ code, message } do back vira ApiError, nunca lido por status', async () => {
    server.use(
      http.get(`${API}/probe`, () =>
        HttpResponse.json({ code: 'VALIDATION_ERROR', message: 'Dados inválidos' }, { status: 400 }),
      ),
    )

    await expect(api.get('/probe')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
    })
  })

  it('campos extra do corpo do erro (ex.: takenSeatIds de SEAT_TAKEN, etapa 06) viram `details`', async () => {
    server.use(
      http.post(`${API}/probe`, () =>
        HttpResponse.json(
          { code: 'SEAT_TAKEN', message: 'Assento já reservado', takenSeatIds: ['seat-1', 'seat-2'] },
          { status: 409 },
        ),
      ),
    )

    await expect(api.post('/probe')).rejects.toMatchObject({
      code: 'SEAT_TAKEN',
      details: { takenSeatIds: ['seat-1', 'seat-2'] },
    })
  })

  it('erro sem campos extra além de code/message/requestId -- `details` fica undefined, não um objeto vazio', async () => {
    server.use(
      http.get(`${API}/probe`, () =>
        HttpResponse.json({ code: 'VALIDATION_ERROR', message: 'Dados inválidos' }, { status: 400 }),
      ),
    )

    await expect(api.get('/probe')).rejects.toMatchObject({ details: undefined })
  })

  it('guarda o requestId de um 500 para a tela de falha mostrar (§5.5.7)', async () => {
    server.use(
      http.get(`${API}/probe`, () =>
        HttpResponse.json(
          { code: 'INTERNAL_ERROR', message: 'Erro interno', requestId: 'req-123' },
          { status: 500 },
        ),
      ),
    )

    await expect(api.get('/probe')).rejects.toMatchObject({ requestId: 'req-123' })
  })
})

describe('api -- fila de refresh (§ etapa 01, "bug mais provável desta etapa")', () => {
  it('um 401 dispara exatamente um /auth/refresh e repete a requisição original com o token novo', async () => {
    let refreshCount = 0
    server.use(
      http.get(`${API}/probe`, ({ request }) => {
        if (request.headers.get('authorization') === 'Bearer new-token') {
          return HttpResponse.json({ ok: true })
        }
        return HttpResponse.json({ code: 'UNAUTHORIZED', message: 'Token expirado' }, { status: 401 })
      }),
      http.post(`${API}/auth/refresh`, () => {
        refreshCount++
        return HttpResponse.json({ accessToken: 'new-token' })
      }),
    )

    const result = await api.get<{ ok: boolean }>('/probe')

    expect(result).toEqual({ ok: true })
    expect(refreshCount).toBe(1)
    expect(getAccessToken()).toBe('new-token')
  })

  it('cinco requisições concorrentes com token expirado disparam só UM /auth/refresh', async () => {
    let refreshCount = 0
    server.use(
      http.get(`${API}/probe`, ({ request }) => {
        if (request.headers.get('authorization') === 'Bearer new-token') {
          return HttpResponse.json({ ok: true })
        }
        return HttpResponse.json({ code: 'UNAUTHORIZED', message: 'Token expirado' }, { status: 401 })
      }),
      http.post(`${API}/auth/refresh`, () => {
        refreshCount++
        return HttpResponse.json({ accessToken: 'new-token' })
      }),
    )

    const results = await Promise.all(Array.from({ length: 5 }, () => api.get<{ ok: boolean }>('/probe')))

    expect(results).toEqual(Array.from({ length: 5 }, () => ({ ok: true })))
    expect(refreshCount).toBe(1)
  })

  it('dois 401 seguidos (refresh não resolve) limpam a sessão e notificam onSessionExpired', async () => {
    server.use(
      http.get(`${API}/probe`, () =>
        HttpResponse.json({ code: 'UNAUTHORIZED', message: 'Token expirado' }, { status: 401 }),
      ),
      http.post(`${API}/auth/refresh`, () => HttpResponse.json({ accessToken: 'novo-mas-ainda-nao-resolve' })),
    )

    let notified = false
    const unsubscribe = onSessionExpired(() => {
      notified = true
    })

    await expect(api.get('/probe')).rejects.toBeInstanceOf(ApiError)

    expect(notified).toBe(true)
    expect(getAccessToken()).toBeNull()
    unsubscribe()
  })

  it('refresh sem sessão (cookie ausente) também limpa e notifica, sem tentar de novo', async () => {
    server.use(
      http.get(`${API}/probe`, () =>
        HttpResponse.json({ code: 'UNAUTHORIZED', message: 'Token expirado' }, { status: 401 }),
      ),
      http.post(`${API}/auth/refresh`, () =>
        HttpResponse.json({ code: 'UNAUTHORIZED', message: 'Sessão ausente' }, { status: 401 }),
      ),
    )

    await expect(api.get('/probe')).rejects.toBeInstanceOf(ApiError)
    expect(getAccessToken()).toBeNull()
  })

  it('corpo FormData não é serializado nem ganha Content-Type manual (upload de imagem, etapa 04)', async () => {
    let receivedContentType: string | null = null
    let receivedField: string | null = null
    server.use(
      http.post(`${API}/probe-upload`, async ({ request }) => {
        receivedContentType = request.headers.get('content-type')
        const body = await request.formData()
        receivedField = body.get('image') as string | null
        return HttpResponse.json({ ok: true })
      }),
    )

    const formData = new FormData()
    formData.append('image', 'fake-bytes')

    await api.post('/probe-upload', formData)

    expect(receivedContentType).toContain('multipart/form-data')
    expect(receivedField).toBe('fake-bytes')
  })

  it('rota de auth (skipAuth) não tenta refresh num 401 -- é credencial errada, não sessão expirada', async () => {
    let refreshCount = 0
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ code: 'UNAUTHORIZED', message: 'Credenciais inválidas' }, { status: 401 }),
      ),
      http.post(`${API}/auth/refresh`, () => {
        refreshCount++
        return HttpResponse.json({ accessToken: 'x' })
      }),
    )

    await expect(
      api.post('/auth/login', { email: 'a@a.com', password: 'x' }, { skipAuth: true }),
    ).rejects.toBeInstanceOf(ApiError)
    expect(refreshCount).toBe(0)
  })
})
