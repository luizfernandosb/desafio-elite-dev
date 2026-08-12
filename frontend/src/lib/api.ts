import { env } from './env'

// Contrato de listagem do back-end (§5.6.2) -- nenhuma tela desembrulha `meta` à mão.
export interface Paginated<T> {
  data: T[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// Toda resposta de erro do back é `{ code, message }` (§5.5.4). A UI trata por `code`,
// nunca por `status` nem pelo texto de `message` -- renomear uma mensagem no back-end
// não pode quebrar um `if` no front.
export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly requestId?: string

  // sem parameter properties (`public readonly code: string` no construtor) --
  // `erasableSyntaxOnly` do tsconfig proíbe qualquer sintaxe de classe que precise
  // gerar código além de apagar tipos, e parameter properties geram `this.code = code`
  constructor(code: string, message: string, status: number, requestId?: string) {
    super(message)
    this.code = code
    this.status = status
    this.requestId = requestId
  }
}

const TIMEOUT_MS = 15_000

// Access token em memória, nunca em localStorage (etapa 03 do plano de front) --
// XSS que rouba localStorage rouba a sessão inteira; em memória, sobrevive só à aba.
let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

type SessionExpiredListener = () => void
let sessionExpiredListeners: SessionExpiredListener[] = []

// api.ts não conhece o router -- quem quiser redirecionar para /entrar quando a
// sessão cair (dois 401 seguidos) se inscreve aqui. Mantém o cliente HTTP livre de
// qualquer dependência de UI.
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.push(listener)
  return () => {
    sessionExpiredListeners = sessionExpiredListeners.filter((l) => l !== listener)
  }
}

function notifySessionExpired(): void {
  setAccessToken(null)
  for (const listener of sessionExpiredListeners) listener()
}

// Fila de refresh: sem isto, N requisições simultâneas com token expirado disparam N
// chamadas a /auth/refresh -- e a rotação de refresh token do back-end (etapa 03)
// invalida a família inteira no segundo uso, deslogando o usuário por causa do próprio
// mecanismo de segurança. `??=` garante que só a primeira chamada de fato dispara a
// requisição; as demais recebem a mesma promise em andamento (§ etapa 01, "bug mais
// provável desta etapa").
let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  refreshPromise ??= (async () => {
    try {
      const res = await fetch(`${env.VITE_API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // o refresh é cookie httpOnly, não Authorization
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!res.ok) return null

      const body = (await res.json()) as { accessToken: string }
      setAccessToken(body.accessToken)
      return body.accessToken
    } catch {
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  // rotas de auth (login, register, google, refresh) não carregam Authorization e um
  // 401 delas é credencial errada, não sessão expirada -- não tentam refresh
  skipAuth?: boolean
}

interface ErrorBody {
  code: string
  message: string
  requestId?: string
}

async function parseErrorBody(res: Response): Promise<ErrorBody> {
  try {
    const body = (await res.json()) as Partial<ErrorBody>
    return { code: body.code ?? 'UNKNOWN_ERROR', message: body.message ?? res.statusText, requestId: body.requestId }
  } catch {
    return { code: 'UNKNOWN_ERROR', message: res.statusText || 'Erro desconhecido' }
  }
}

async function rawFetch(path: string, options: RequestOptions): Promise<Response> {
  const headers = new Headers(options.headers)
  // FormData (upload de imagem, etapa 04) não passa por JSON.stringify nem ganha
  // Content-Type manual -- o browser define `multipart/form-data; boundary=...`
  // sozinho; sobrescrever aqui quebraria o parsing do multer no back-end.
  const isFormData = options.body instanceof FormData
  if (options.body !== undefined && !isFormData) headers.set('Content-Type', 'application/json')
  if (!options.skipAuth && accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  return fetch(`${env.VITE_API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
    signal: options.signal ?? AbortSignal.timeout(TIMEOUT_MS),
    body: isFormData ? (options.body as FormData) : options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
}

async function apiFetch<T>(path: string, options: RequestOptions, isRetry = false): Promise<T> {
  const res = await rawFetch(path, options)

  if (res.status === 401 && !options.skipAuth) {
    if (!isRetry) {
      const newToken = await refreshAccessToken()
      if (newToken) return apiFetch<T>(path, options, true)
    }
    // segundo 401 seguido (ou refresh que não devolveu token novo): a sessão de fato
    // acabou, não é mais um problema de token momentaneamente velho
    notifySessionExpired()
    const error = await parseErrorBody(res)
    throw new ApiError(error.code, error.message, res.status, error.requestId)
  }

  if (!res.ok) {
    const error = await parseErrorBody(res)
    throw new ApiError(error.code, error.message, res.status, error.requestId)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: 'DELETE' }),
}
