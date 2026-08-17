import { http, HttpResponse } from 'msw'
import { env } from '../../../lib/env'
import type { Order, PaymentMethod, SimulateOutcome } from '../../../features/checkout/api'
import { DEFAULT_EVENT } from './catalog'
import { priceTypeFromHoldId, seatIdFromHoldId } from './seats'
import { issueTicket } from './tickets'

function seatPriceInCents(holdId: string): number {
  return priceTypeFromHoldId(holdId) === 'HALF'
    ? Math.round(DEFAULT_EVENT.priceInCents / 2)
    : DEFAULT_EVENT.priceInCents
}

const API = env.VITE_API_URL

export const ordersStore = new Map<string, Order>()

export function resetOrdersStore(): void {
  ordersStore.clear()
}

export const ordersHandlers = [
  http.post(`${API}/orders`, async ({ request }) => {
    const body = (await request.json()) as { eventId: string; holdIds: string[]; paymentMethod?: PaymentMethod }
    const id = `order-${ordersStore.size + 1}`
    const now = new Date()
    const paymentMethod = body.paymentMethod ?? 'FAKE'
    const order: Order = {
      id,
      userId: 'user-cliente',
      eventId: body.eventId,
      status: 'PENDING',
      amountInCents: body.holdIds.reduce((sum, holdId) => sum + seatPriceInCents(holdId), 0),
      currency: DEFAULT_EVENT.currency,
      paymentMethod,
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      holds: body.holdIds.map((holdId) => ({
        id: holdId,
        seatId: seatIdFromHoldId(holdId),
        expiresAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
        releasedAt: null,
      })),
    }
    ordersStore.set(id, order)
    return HttpResponse.json({ order, clientSecret: 'pi_fake_secret' }, { status: 201 })
  }),

  http.get(`${API}/orders/:id`, ({ params }) => {
    const order = ordersStore.get(params.id as string)
    if (!order) return HttpResponse.json({ code: 'NOT_FOUND', message: 'Pedido não encontrado' }, { status: 404 })
    return HttpResponse.json(order)
  }),

  http.post(`${API}/orders/:id/simulate-payment`, async ({ params, request }) => {
    const order = ordersStore.get(params.id as string)
    if (!order) return HttpResponse.json({ code: 'NOT_FOUND', message: 'Pedido não encontrado' }, { status: 404 })
    const body = (await request.json()) as { outcome: SimulateOutcome }
    order.updatedAt = new Date().toISOString()

    if (body.outcome === 'succeeded') {
      order.status = 'PAID'
      for (const hold of order.holds) {
        issueTicket({
          orderId: order.id,
          seatId: hold.seatId,
          eventId: order.eventId,
          eventTitle: DEFAULT_EVENT.title,
          eventStartsAt: DEFAULT_EVENT.startsAt,
          venueName: DEFAULT_EVENT.venueName,
          venueCity: DEFAULT_EVENT.venueCity,
          timezone: DEFAULT_EVENT.timezone,
          priceType: priceTypeFromHoldId(hold.id),
        })
      }
    } else {
      order.status = 'FAILED'
    }

    return new HttpResponse(null, { status: 204 })
  }),
]
