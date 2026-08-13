import { http, HttpResponse } from 'msw'
import { env } from '../../../lib/env'

const API = env.VITE_API_URL

// Convenção só destes handlers de teste (não existe no back real): o id do hold é
// `hold-<seatId>` -- previsível o bastante para `orders.ts` reconstruir qual
// assento cada `holdId` recebido em `POST /orders` representa, sem precisar de um
// terceiro módulo de estado compartilhado só para isso.
export function seatIdFromHoldId(holdId: string): string {
  return holdId.replace(/^hold-/, '')
}

export const seatsHandlers = [
  http.post(`${API}/events/:id/holds`, async ({ params, request }) => {
    const body = (await request.json()) as { seatIds: string[] }
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const holds = body.seatIds.map((seatId) => ({
      id: `hold-${seatId}`,
      eventId: params.id as string,
      seatId,
      userId: 'user-cliente',
      expiresAt,
    }))
    return HttpResponse.json({ data: holds }, { status: 201 })
  }),

  http.delete(`${API}/events/:id/holds/:holdId`, () => new HttpResponse(null, { status: 204 })),
]
