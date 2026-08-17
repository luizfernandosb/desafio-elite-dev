import { http, HttpResponse } from 'msw'
import { env } from '../../../lib/env'
import type { PublicUser } from '../../../features/auth/api'

const API = env.VITE_API_URL

export const TEST_PASSWORD = 'senha-teste-123'

export const TEST_USERS: Record<string, PublicUser> = {
  'cliente@teste.dev': { id: 'user-cliente', name: 'Cliente Teste', email: 'cliente@teste.dev', role: 'CUSTOMER' },
  'portaria@teste.dev': { id: 'user-portaria', name: 'Portaria Teste', email: 'portaria@teste.dev', role: 'GATE' },
  'organizador@teste.dev': {
    id: 'user-organizador',
    name: 'Organizador Teste',
    email: 'organizador@teste.dev',
    role: 'ORGANIZER',
  },
}

export const authHandlers = [
  http.post(`${API}/auth/refresh`, () =>
    HttpResponse.json({ code: 'UNAUTHORIZED', message: 'Sessão ausente' }, { status: 401 }),
  ),

  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string }
    const user = TEST_USERS[body.email]
    if (!user || body.password !== TEST_PASSWORD) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: 'Credenciais inválidas' }, { status: 401 })
    }
    return HttpResponse.json({ accessToken: `token-${user.id}`, user })
  }),

  http.post(`${API}/auth/register`, async ({ request }) => {
    const body = (await request.json()) as { name: string; email: string; password: string }
    const user: PublicUser = { id: 'user-novo', name: body.name, email: body.email, role: 'CUSTOMER' }
    return HttpResponse.json({ accessToken: `token-${user.id}`, user }, { status: 201 })
  }),

  http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
]
