import { http, HttpResponse } from 'msw'
import { env } from '../../../lib/env'
import type { Ticket, TicketDetail } from '../../../features/tickets/api'

const API = env.VITE_API_URL

interface StoredTicket extends TicketDetail {
  eventId: string
}

// Estado compartilhado com `orders.ts` (pagamento aprovado -> ingresso emitido) e
// `gate.ts` (validar -> marcar `USED`) -- os três handlers, juntos, são o que faz
// o fluxo ponta a ponta da etapa 13 fechar sem precisar de um back-end de verdade.
// `resetTicketsStore` existe para cada cenário do teste ponta a ponta partir de
// zero ingressos, em vez de um teste enxergar o ingresso emitido pelo anterior.
export const ticketsStore = new Map<string, StoredTicket>()

export function resetTicketsStore(): void {
  ticketsStore.clear()
}

// Assento "seat-a1" -> fileira A, número 1 -- mesma convenção usada pelo mapa de
// assentos (`SeatSelectionPage.tsx`, rótulo = `${row}${number}`).
function seatFromId(seatId: string): Ticket['seat'] {
  const match = /^seat-([a-z]+)(\d+)$/i.exec(seatId)
  if (!match?.[1]) return null
  return { row: match[1].toUpperCase(), number: Number(match[2]) }
}

export function issueTicket(input: {
  orderId: string
  seatId: string
  eventId: string
  eventTitle: string
  eventStartsAt: string
  venueName: string
  venueCity: string
  timezone: string
}): StoredTicket {
  const ticket: StoredTicket = {
    id: `ticket-${input.orderId}-${input.seatId}`,
    eventId: input.eventId,
    status: 'ACTIVE',
    usedAt: null,
    createdAt: new Date().toISOString(),
    event: {
      id: input.eventId,
      title: input.eventTitle,
      imageUrl: null,
      startsAt: input.eventStartsAt,
      endsAt: null,
      timezone: input.timezone,
      venueName: input.venueName,
      venueCity: input.venueCity,
    },
    seat: seatFromId(input.seatId),
    // "código de validação" só precisa ser único e opaco aqui -- o back real
    // assina um JWT (§ etapa 08 do back); os testes de front nunca verificam
    // assinatura, só que o MESMO código mostrado no ingresso valida na portaria.
    code: `TKT1.${input.orderId}.${input.seatId}`,
  }
  ticketsStore.set(ticket.id, ticket)
  return ticket
}

export function findTicketByCode(code: string): StoredTicket | undefined {
  return [...ticketsStore.values()].find((ticket) => ticket.code === code)
}

function toListItem(ticket: StoredTicket): Ticket {
  const { eventId: _eventId, code: _code, ...listItem } = ticket
  return listItem
}

export const ticketsHandlers = [
  http.get(`${API}/tickets`, () => {
    const data = [...ticketsStore.values()].map(toListItem)
    return HttpResponse.json({
      data,
      meta: { page: 1, limit: 20, total: data.length, totalPages: 1, hasNext: false, hasPrev: false },
    })
  }),

  http.get(`${API}/tickets/:id`, ({ params }) => {
    const ticket = ticketsStore.get(params.id as string)
    if (!ticket) return HttpResponse.json({ code: 'NOT_FOUND', message: 'Ingresso não encontrado' }, { status: 404 })
    const { eventId: _eventId, ...detail } = ticket
    return HttpResponse.json(detail)
  }),

  http.post(`${API}/tickets/:id/share`, ({ params }) => {
    const ticket = ticketsStore.get(params.id as string)
    if (!ticket) return HttpResponse.json({ code: 'NOT_FOUND', message: 'Ingresso não encontrado' }, { status: 404 })
    return HttpResponse.json({
      url: `http://localhost:5173/share/token-${ticket.id}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
  }),

  http.delete(`${API}/tickets/:id/share`, () => new HttpResponse(null, { status: 204 })),
]
