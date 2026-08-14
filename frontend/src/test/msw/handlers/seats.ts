import { http, HttpResponse } from 'msw'
import { env } from '../../../lib/env'
import type { TicketPriceType } from '../../../shared/ticket-price-type'

const API = env.VITE_API_URL

// Convenção só destes handlers de teste (não existe no back real): o id do hold é
// `hold-<seatId>-<priceType>` -- previsível o bastante para `orders.ts` reconstruir
// qual assento e qual tipo de ingresso (meia-entrada) cada `holdId` recebido em
// `POST /orders` representa, sem precisar de um terceiro módulo de estado
// compartilhado só para isso.
export function seatIdFromHoldId(holdId: string): string {
  return holdId.replace(/^hold-/, '').replace(/-(FULL|HALF)$/, '')
}

export function priceTypeFromHoldId(holdId: string): TicketPriceType {
  return /-HALF$/.test(holdId) ? 'HALF' : 'FULL'
}

export const seatsHandlers = [
  http.post(`${API}/events/:id/holds`, async ({ params, request }) => {
    const body = (await request.json()) as { seats: { seatId: string; priceType: TicketPriceType }[] }
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const holds = body.seats.map(({ seatId, priceType }) => ({
      id: `hold-${seatId}-${priceType}`,
      eventId: params.id as string,
      seatId,
      userId: 'user-cliente',
      priceType,
      expiresAt,
    }))
    return HttpResponse.json({ data: holds }, { status: 201 })
  }),

  http.delete(`${API}/events/:id/holds/:holdId`, () => new HttpResponse(null, { status: 204 })),
]
