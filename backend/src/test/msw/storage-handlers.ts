import { http, HttpResponse } from 'msw'
import { env } from '../../config/env'

// Supabase Storage mockado por MSW em CI -- nenhum upload real (etapa 12). Endpoints
// conferidos lendo o código-fonte de @supabase/storage-js: upload é
// `POST {SUPABASE_URL}/storage/v1/object/{bucket}/{key}`, remove é
// `DELETE {SUPABASE_URL}/storage/v1/object/{bucket}` com body `{ prefixes: string[] }`.
// `getPublicUrl` não faz chamada de rede -- é montada localmente a partir da key que o
// próprio back-end gera, por isso não precisa de handler.
const STORAGE_OBJECT_BASE = `${env.SUPABASE_URL}/storage/v1/object`

// exposto para os testes de integração assertarem "a imagem anterior foi removida do
// bucket" sem precisar inspecionar chamadas de fetch diretamente
export const removedStorageKeys: string[] = []

export const storageHandlers = [
  http.post(`${STORAGE_OBJECT_BASE}/event-images/*`, () => HttpResponse.json({ Id: 'mock-id', Key: 'mock-key' })),

  http.delete(`${STORAGE_OBJECT_BASE}/event-images`, async ({ request }) => {
    const body = (await request.json()) as { prefixes: string[] }
    removedStorageKeys.push(...body.prefixes)
    return HttpResponse.json(body.prefixes.map((name) => ({ name })))
  }),
]
