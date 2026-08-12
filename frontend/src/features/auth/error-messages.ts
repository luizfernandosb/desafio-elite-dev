import { ApiError } from '../../lib/api'

// Tratado por `code`, nunca por status nem por texto da mensagem (§5.5.4) -- exceto
// o único caso em que status é o próprio sinal: POST /auth/login não tem OUTRO
// motivo para devolver 401 além de credencial errada (o back usa o código genérico
// `UNAUTHORIZED` tanto aqui quanto em "sem token" -- não existe um `INVALID_CREDENTIALS`
// de verdade na API; ver docs/bugs.md). A mensagem é a mesma para e-mail inexistente e
// senha errada -- o back já garante isso (§7.1); não "melhorar" inferindo qual dos dois foi.
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

// Só caminhos internos -- nunca navega para fora do app a partir de um parâmetro de
// URL (?redirect=https://...).
export function safeRedirectTarget(value: string | null): string {
  return value && value.startsWith('/') ? value : '/'
}
