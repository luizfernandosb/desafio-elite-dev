import { ApiError } from '../../lib/api'

// Diferente dos seis resultados negativos (que são 200 de sucesso, tratados por
// `status.ts`) -- isto é para o que sobra: rede caiu, sessão expirou, rate limit do
// operador (§ etapa 10, `express-rate-limit` em `/gate/validate`). Erro de verdade,
// não um resultado operacional esperado.
export function gateValidationErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'RATE_LIMITED') return 'Muitas validações em pouco tempo. Aguarde um instante.'
    return err.message
  }
  return 'Não foi possível validar. Tente de novo.'
}
