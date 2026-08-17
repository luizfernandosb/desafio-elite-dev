import { ApiError } from '../../lib/api'

export function gateValidationErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'RATE_LIMITED') return 'Muitas validações em pouco tempo. Aguarde um instante.'
    return err.message
  }
  return 'Não foi possível validar. Tente de novo.'
}
