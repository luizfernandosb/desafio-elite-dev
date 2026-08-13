import { http, HttpResponse } from 'msw'
import { env } from '../../../lib/env'
import type { GateValidationResponse } from '../../../features/gate/api'
import { findTicketByCode, ticketsStore } from './tickets'

const API = env.VITE_API_URL

function seatLabel(seat: { row: string; number: number } | null): string | null {
  return seat ? `${seat.row}${seat.number}` : null
}

export const gateHandlers = [
  http.post(`${API}/gate/validate`, async ({ request }) => {
    const body = (await request.json()) as { code: string; eventId: string }
    const ticket = findTicketByCode(body.code)

    if (!ticket) {
      return HttpResponse.json({
        result: 'NOT_FOUND',
        ticket: null,
        usedAt: null,
        validatedBy: null,
        message: 'Ingresso não encontrado',
      } satisfies GateValidationResponse)
    }

    if (ticket.eventId !== body.eventId) {
      return HttpResponse.json({
        result: 'WRONG_EVENT',
        ticket: null,
        usedAt: null,
        validatedBy: null,
        message: 'Ingresso de outro evento',
      } satisfies GateValidationResponse)
    }

    if (ticket.status === 'USED') {
      return HttpResponse.json({
        result: 'ALREADY_USED',
        ticket: { seat: seatLabel(ticket.seat), eventTitle: ticket.event.title },
        usedAt: ticket.usedAt,
        validatedBy: 'Portaria Teste',
        message: 'Ingresso já utilizado',
      } satisfies GateValidationResponse)
    }

    ticket.status = 'USED'
    ticket.usedAt = new Date().toISOString()

    return HttpResponse.json({
      result: 'VALID',
      ticket: { seat: seatLabel(ticket.seat), eventTitle: ticket.event.title },
      usedAt: null,
      validatedBy: null,
      message: 'Entrada liberada',
    } satisfies GateValidationResponse)
  }),

  http.get(`${API}/gate/events/:id/stats`, ({ params }) => {
    const eventTickets = [...ticketsStore.values()].filter((ticket) => ticket.eventId === params.id)
    const used = eventTickets.filter((ticket) => ticket.status === 'USED').length
    return HttpResponse.json({
      total: eventTickets.length,
      used,
      remaining: eventTickets.length - used,
      lastValidations: [],
    })
  }),
]
