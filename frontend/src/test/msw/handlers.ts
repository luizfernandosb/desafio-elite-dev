import { http, HttpResponse } from 'msw'
import { env } from '../../lib/env'

const API = env.VITE_API_URL

// Handlers com os contratos reais do back-end, escritos antes (ou independente) da
// tela que os consome (§5.6.1) -- crescem por feature a partir da etapa 03. Por ora
// só o que a própria etapa 01 já usa de verdade: o cliente HTTP tenta renovar sessão
// em qualquer 401, então precisa de uma resposta para /auth/refresh mesmo sem nenhuma
// tela de auth ainda. Sem cookie de sessão (visitante), a resposta real do back é 401.
export const handlers = [
  http.post(`${API}/auth/refresh`, () =>
    HttpResponse.json({ code: 'UNAUTHORIZED', message: 'Sessão ausente' }, { status: 401 }),
  ),
]
