import { api, type Paginated } from '../../lib/api'
import type { SessionAudio, SessionFormat, SessionRoomType } from '../../shared/session-attributes'
import type { TicketPriceType } from '../../shared/ticket-price-type'

export type { TicketPriceType }
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
  format: SessionFormat
  audio: SessionAudio
  roomType: SessionRoomType
}

export interface TicketSeat {
  row: string
  number: number
}

export interface Ticket {
  id: string
  status: TicketStatus
  priceType: TicketPriceType
  usedAt: string | null
  createdAt: string
  event: TicketEventSummary
  seat: TicketSeat | null
}

export interface TicketDetail extends Ticket {
  code: string
}

export interface ShareLink {
  url: string
  expiresAt: string
}

export interface SharedTicketView {
  event: Pick<
    TicketEventSummary,
    'title' | 'imageUrl' | 'startsAt' | 'timezone' | 'venueName' | 'venueCity' | 'format' | 'audio' | 'roomType'
  >
  seat: TicketSeat | null
  ticket: { code: string; status: TicketStatus; priceType: TicketPriceType }
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

export function createShareLink(id: string) {
  return api.post<ShareLink>(`/tickets/${id}/share`)
}

export function revokeShareLink(id: string) {
  return api.delete<void>(`/tickets/${id}/share`)
}

export function cancelTicket(id: string) {
  return api.post<TicketDetail>(`/tickets/${id}/cancel`)
}

export function getSharedTicket(shareToken: string) {
  return api.get<SharedTicketView>(`/share/${shareToken}`)
}
