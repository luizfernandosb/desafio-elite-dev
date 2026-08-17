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

export function logoutRequest() {
  return api.post<void>('/auth/logout')
}

export function meRequest() {
  return api.get<PublicUser>('/auth/me')
}
