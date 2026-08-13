import { api, type Paginated } from '../../lib/api'

export type TicketStatus = 'ACTIVE' | 'USED' | 'CANCELLED'

export interface TicketEventSummary {
  id: string
  title: string
  imageUrl: string | null
  startsAt: string
  endsAt: string | null
  timezone: string
  venueName: string
  venueCity: string
}

export interface TicketSeat {
  row: string
  number: number
}

export interface Ticket {
  id: string
  status: TicketStatus
  usedAt: string | null
  createdAt: string
  event: TicketEventSummary
  seat: TicketSeat | null
}

// `code` só existe aqui, nunca na listagem (back: `ticket.service.ts`, `toPublicTicket`
// nunca inclui o QR em claro) -- espelha a decisão do back de não vazar o código de
// validação numa tela que nem mostra QR.
export interface TicketDetail extends Ticket {
  code: string
}

export interface ShareLink {
  url: string
  expiresAt: string
}

// payload mínimo da página pública (§7.7) -- sem ticketId, orderId, nome ou e-mail de
// quem comprou, igual ao que o back devolve (`SharedTicketView`)
export interface SharedTicketView {
  event: Pick<TicketEventSummary, 'title' | 'imageUrl' | 'startsAt' | 'timezone' | 'venueName' | 'venueCity'>
  seat: TicketSeat | null
  ticket: { code: string; status: TicketStatus }
}

export const ticketKeys = {
  all: ['tickets'] as const,
  list: (page: number) => [...ticketKeys.all, 'list', page] as const,
  detail: (id: string) => [...ticketKeys.all, 'detail', id] as const,
  shared: (shareToken: string) => [...ticketKeys.all, 'shared', shareToken] as const,
}

export function listTickets(page: number) {
  const search = new URLSearchParams({ page: String(page) })
  return api.get<Paginated<Ticket>>(`/tickets?${search.toString()}`)
}

export function getTicket(id: string) {
  return api.get<TicketDetail>(`/tickets/${id}`)
}

// idempotente enquanto o link vigente existir (back: `TicketService.createShareLink`)
// -- chamar de novo é seguro, sempre devolve o mesmo link em vez de criar um segundo
export function createShareLink(id: string) {
  return api.post<ShareLink>(`/tickets/${id}/share`)
}

export function revokeShareLink(id: string) {
  return api.delete<void>(`/tickets/${id}/share`)
}

// rota pública, sem Authorization (back: `share.routes.ts` não tem `requireAuth`) --
// prefixo `/share`, não `/tickets`, é o mesmo usado por `APP_PUBLIC_URL` na URL que o
// dono recebe (`${APP_PUBLIC_URL}/share/:token`)
export function getSharedTicket(shareToken: string) {
  return api.get<SharedTicketView>(`/share/${shareToken}`)
}
