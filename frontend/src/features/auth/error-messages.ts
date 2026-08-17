import { ApiError } from '../../lib/api'

export function loginErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'RATE_LIMITED') return 'Muitas tentativas. Aguarde um instante.'
    if (err.status === 401) return 'E-mail ou senha incorretos.'
    return err.message
  }
  return 'Não foi possível entrar. Tente de novo.'
}

export function registerErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'RATE_LIMITED') return 'Muitas tentativas. Aguarde um instante.'
    if (err.code === 'EMAIL_TAKEN') return 'Já existe uma conta com este e-mail.'
    return err.message
  }
  return 'Não foi possível criar a conta. Tente de novo.'
}

export function safeRedirectTarget(value: string | null): string {
  return value && value.startsWith('/') ? value : '/'
}
