import { ApiError } from '../lib/api'

export interface ErrorDescription {
  title: string
  message: string
  showRetry: boolean
  requestId?: string
}

const KNOWN_ERRORS: Record<string, { title: string; showRetry: boolean }> = {
  VALIDATION_ERROR: { title: 'Verifique os dados', showRetry: false },
  NOT_FOUND: { title: 'Não encontrado', showRetry: false },
  FORBIDDEN: { title: 'Sem permissão', showRetry: false },
  RATE_LIMITED: { title: 'Muitas tentativas', showRetry: true },
  CATALOG_UNAVAILABLE: { title: 'Catálogo indisponível', showRetry: true },
  TIMEOUT: { title: 'Demorou demais', showRetry: true },
  NETWORK_ERROR: { title: 'Sem conexão', showRetry: true },
}

const DEFAULT_ERROR = { title: 'Algo deu errado', showRetry: true }

export function describeError(error: unknown): ErrorDescription {
  if (error instanceof ApiError) {
    const known = KNOWN_ERRORS[error.code] ?? DEFAULT_ERROR
    return { title: known.title, message: error.message, showRetry: known.showRetry, requestId: error.requestId }
  }

  return { ...DEFAULT_ERROR, message: 'Tente novamente em instantes.' }
}
