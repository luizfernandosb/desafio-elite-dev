import { http, HttpResponse } from 'msw'
import { env } from '../../config/env'

const STORAGE_OBJECT_BASE = `${env.SUPABASE_URL}/storage/v1/object`

export const removedStorageKeys: string[] = []

export const storageHandlers = [
  http.post(`${STORAGE_OBJECT_BASE}/event-images/*`, () => HttpResponse.json({ Id: 'mock-id', Key: 'mock-key' })),

  http.delete(`${STORAGE_OBJECT_BASE}/event-images`, async ({ request }) => {
    const body = (await request.json()) as { prefixes: string[] }
    removedStorageKeys.push(...body.prefixes)
    return HttpResponse.json(body.prefixes.map((name) => ({ name })))
  }),
]
