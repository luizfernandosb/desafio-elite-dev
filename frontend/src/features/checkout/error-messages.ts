import { ApiError } from '../../lib/api'

// HOLD_EXPIRED na criação do pedido nunca vira um erro solto no checkout (§ etapa
// 08) -- quem chama volta ao mapa de assentos e mostra este texto, mesmo raciocínio
// da etapa 06 (o hold morreu, a UI explica e oferece escolher de novo).
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
