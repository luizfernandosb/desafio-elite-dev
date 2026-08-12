import { ApiError } from '../../lib/api'

// Catálogo público não tem `code` próprio para tratar (nenhuma regra de negócio
// específica além de "listar"/"buscar por id") -- o requestId é o que a tela de erro
// mostra para suporte (§5.5.7), a mensagem em si vem direto do back.
export function catalogListErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  return 'Não foi possível carregar as sessões. Tente de novo.'
}

export function catalogRequestId(err: unknown): string | undefined {
  return err instanceof ApiError ? err.requestId : undefined
}
