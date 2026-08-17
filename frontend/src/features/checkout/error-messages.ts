import { ApiError } from '../../lib/api'

export function checkoutErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'HOLD_EXPIRED') {
      return 'O tempo para reservar esgotou e os assentos foram liberados. Escolha de novo.'
    }
    if (err.code === 'RATE_LIMITED') return 'Muitas tentativas. Aguarde um instante.'
    return err.message
  }
  return 'Não foi possível continuar com o pagamento. Tente de novo.'
}

export function isHoldExpired(err: unknown): boolean {
  return err instanceof ApiError && err.code === 'HOLD_EXPIRED'
}
