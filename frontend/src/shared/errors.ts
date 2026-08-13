import { ApiError } from '../lib/api'

export interface ErrorDescription {
  title: string
  message: string
  showRetry: boolean
  requestId?: string
}

// Tabela central (§ etapa 11, §5.5.4) -- por `code`, nunca por status HTTP nem por
// substring de mensagem, mesmo princípio já usado na etapa 03 para erros de auth.
// `CONFLICT`/`SEAT_TAKEN` e códigos de negócio equivalentes (ex.: `HOLD_EXPIRED`,
// `TICKET_CANCELLED`) de propósito NÃO aparecem aqui -- são erro de negócio esperado,
// com tela própria desenhada para aquele significado (checkout, mapa de assentos,
// compartilhamento de ingresso), não o `ErrorState` genérico. Código que cai fora
// desta tabela vira "Algo deu errado" com retry -- o comportamento mais seguro para
// um `code` desconhecido (nunca "sem permissão" ou "não encontrado" por engano).
const KNOWN_ERRORS: Record<string, { title: string; showRetry: boolean }> = {
  VALIDATION_ERROR: { title: 'Verifique os dados', showRetry: false },
  NOT_FOUND: { title: 'Não encontrado', showRetry: false },
  FORBIDDEN: { title: 'Sem permissão', showRetry: false },
  RATE_LIMITED: { title: 'Muitas tentativas', showRetry: true },
  CATALOG_UNAVAILABLE: { title: 'Catálogo indisponível', showRetry: true },
  // os dois só existem no front (`lib/api.ts`, `classifyFetchFailure`) -- o back
  // nunca devolve estes `code`s, porque quando eles acontecem nenhuma resposta HTTP
  // chega a existir
  TIMEOUT: { title: 'Demorou demais', showRetry: true },
  NETWORK_ERROR: { title: 'Sem conexão', showRetry: true },
}

const DEFAULT_ERROR = { title: 'Algo deu errado', showRetry: true }

// Consumido pelo `ErrorState` (componente central desta etapa) -- toda tela que
// mostra um erro de infraestrutura usa esta função, nunca um `if` improvisado local.
export function describeError(error: unknown): ErrorDescription {
  if (error instanceof ApiError) {
    const known = KNOWN_ERRORS[error.code] ?? DEFAULT_ERROR
    return { title: known.title, message: error.message, showRetry: known.showRetry, requestId: error.requestId }
  }

  // erro que não passou pelo cliente HTTP (ex.: exceção síncrona de código local) --
  // nunca mostra `error.message` cru: não é garantido que seja um texto para humano
  return { ...DEFAULT_ERROR, message: 'Tente novamente em instantes.' }
}
