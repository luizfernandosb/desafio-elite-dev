import { api } from '../../lib/api'
import type { SessionAudio, SessionFormat, SessionRoomType } from '../../shared/session-attributes'
import type { TicketPriceType } from '../../shared/ticket-price-type'

export type { TicketPriceType }
export type SeatKind = 'REGULAR' | 'ACCESSIBLE' | 'COMPANION'
export type SeatStatus = 'FREE' | 'HELD' | 'SOLD'

export interface ReservaEvent {
  id: string
  title: string
  venueName: string
  venueCity: string
  format: SessionFormat
  audio: SessionAudio
  roomType: SessionRoomType
  status: 'PUBLISHED' | 'CANCELLED'
  startsAt: string
  timezone: string
  priceInCents: number
  currency: string
}

export interface SeatmapSeat {
  id: string
  number: number
  kind: SeatKind
  status: SeatStatus
}

export interface SeatmapRow {
  row: string
  seats: SeatmapSeat[]
}

export interface Seatmap {
  eventId: string
  rows: SeatmapRow[]
  meta: { generatedAt: string; priceInCents: number; effectivePriceInCents: number; currency: string }
}

export interface SeatHold {
  id: string
  eventId: string
  seatId: string
  userId: string
  priceType: TicketPriceType
  expiresAt: string
}

export interface SeatSelection {
  seatId: string
  priceType: TicketPriceType
}

export const reservaKeys = {
  all: ['reserva'] as const,
  event: (id: string) => [...reservaKeys.all, 'event', id] as const,
  seatmap: (id: string) => [...reservaKeys.all, 'seatmap', id] as const,
}

export function getEvent(id: string) {
  return api.get<ReservaEvent>(`/events/${id}`)
}

export function getSeatmap(id: string) {
  return api.get<Seatmap>(`/events/${id}/seatmap`)
}

export const MAX_SEATS_PER_HOLD = 6

export function createHold(eventId: string, seats: SeatSelection[]) {
  return api.post<{ data: SeatHold[] }>(`/events/${eventId}/holds`, { seats })
}

export function releaseHold(eventId: string, holdId: string) {
  return api.delete<void>(`/events/${eventId}/holds/${holdId}`)
}
