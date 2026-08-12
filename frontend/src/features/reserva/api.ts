import { api } from '../../lib/api'

export type SeatKind = 'REGULAR' | 'ACCESSIBLE' | 'COMPANION'
export type SeatStatus = 'FREE' | 'HELD' | 'SOLD'

export interface ReservaEvent {
  id: string
  title: string
  venueName: string
  venueCity: string
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
  meta: { generatedAt: string; priceInCents: number; currency: string }
}

// `SeatHold` do back (seat-hold.service.ts) -- um hold por assento, mesmo quando
// criados juntos numa única chamada (`POST .../holds` aceita vários `seatIds`, mas
// devolve um array de holds individuais, não "um hold com N assentos").
export interface SeatHold {
  id: string
  eventId: string
  seatId: string
  userId: string
  expiresAt: string
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

// teto de 6 assentos por hold, igual ao back (seat-hold.schema.ts, MAX_SEATS_PER_HOLD)
export const MAX_SEATS_PER_HOLD = 6

export function createHold(eventId: string, seatIds: string[]) {
  return api.post<{ data: SeatHold[] }>(`/events/${eventId}/holds`, { seatIds })
}

export function releaseHold(eventId: string, holdId: string) {
  return api.delete<void>(`/events/${eventId}/holds/${holdId}`)
}
