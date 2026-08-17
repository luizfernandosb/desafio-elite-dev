import { env } from './env'

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

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly requestId?: string
  readonly details?: Record<string, unknown>

  constructor(
    code: string,
    message: string,
    status: number,
    requestId?: string,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.code = code
    this.status = status
    this.requestId = requestId
    this.details = details
  }
}

const TIMEOUT_MS = 15_000

let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

type SessionExpiredListener = () => void
let sessionExpiredListeners: SessionExpiredListener[] = []

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

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  refreshPromise ??= (async () => {
    try {
      const res = await fetch(`${env.VITE_API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
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
  skipAuth?: boolean
}

interface ErrorBody {
  code: string
  message: string
  requestId?: string
  [key: string]: unknown
}

interface ParsedError {
  code: string
  message: string
  requestId?: string
  details?: Record<string, unknown>
}

async function parseErrorBody(res: Response): Promise<ParsedError> {
  try {
    const body = (await res.json()) as Partial<ErrorBody>
    const { code, message, requestId, ...details } = body
    return {
      code: code ?? 'UNKNOWN_ERROR',
      message: message ?? res.statusText,
      requestId: requestId as string | undefined,
      details: Object.keys(details).length > 0 ? details : undefined,
    }
  } catch {
    return { code: 'UNKNOWN_ERROR', message: res.statusText || 'Erro desconhecido' }
  }
}

async function rawFetch(path: string, options: RequestOptions): Promise<Response> {
  const headers = new Headers(options.headers)
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

export function classifyFetchFailure(err: unknown): ApiError {
  if (err instanceof DOMException && err.name === 'TimeoutError') {
    return new ApiError('TIMEOUT', 'A operação demorou mais que o esperado.', 0)
  }
  return new ApiError('NETWORK_ERROR', 'Sem conexão com o servidor. Verifique sua internet.', 0)
}

async function apiFetch<T>(path: string, options: RequestOptions, isRetry = false): Promise<T> {
  let res: Response
  try {
    res = await rawFetch(path, options)
  } catch (err) {
    throw classifyFetchFailure(err)
  }

  if (res.status === 401 && !options.skipAuth) {
    if (!isRetry) {
      const newToken = await refreshAccessToken()
      if (newToken) return apiFetch<T>(path, options, true)
    }
    notifySessionExpired()
    const error = await parseErrorBody(res)
    throw new ApiError(error.code, error.message, res.status, error.requestId, error.details)
  }

  if (!res.ok) {
    const error = await parseErrorBody(res)
    throw new ApiError(error.code, error.message, res.status, error.requestId, error.details)
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
