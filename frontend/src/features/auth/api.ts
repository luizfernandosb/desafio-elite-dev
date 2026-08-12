import { api } from '../../lib/api'

export type Role = 'ORGANIZER' | 'CUSTOMER' | 'GATE'

export interface PublicUser {
  id: string
  name: string
  email: string
  role: Role
}

interface SessionResponse {
  accessToken: string
  user: PublicUser
}

// skipAuth: true nas quatro que não carregam (ou não podem depender de) um
// Authorization válido -- um 401 delas é credencial/sessão errada, não token velho,
// então não deveriam disparar a fila de refresh de lib/api.ts (etapa 01).
export function registerRequest(input: { name: string; email: string; password: string }) {
  return api.post<SessionResponse>('/auth/register', input, { skipAuth: true })
}

export function loginRequest(input: { email: string; password: string }) {
  return api.post<SessionResponse>('/auth/login', input, { skipAuth: true })
}

export function refreshRequest() {
  return api.post<{ accessToken: string }>('/auth/refresh', undefined, { skipAuth: true })
}

export function googleLoginRequest(credential: string) {
  return api.post<SessionResponse>('/auth/google', { credential }, { skipAuth: true })
}

// logout carrega o Authorization normalmente -- o back-end exige sessão válida
// para revogar o refresh certo (requireAuth na rota, back-end etapa 03)
export function logoutRequest() {
  return api.post<void>('/auth/logout')
}

export function meRequest() {
  return api.get<PublicUser>('/auth/me')
}
