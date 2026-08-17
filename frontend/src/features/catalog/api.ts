import { api, type Paginated } from '../../lib/api'
import type { SessionAudio, SessionFormat, SessionRoomType } from '../../shared/session-attributes'

export type PublicEventStatus = 'PUBLISHED' | 'CANCELLED'

export interface PublicEvent {
  id: string
  source: string
  externalId: string
  title: string
  subtitle?: string
  synopsis?: string
  imageUrl?: string
  runtimeMinutes?: number
  genres: string[]
  ageRating?: string
  venueName: string
  venueCity: string
  format: SessionFormat
  audio: SessionAudio
  roomType: SessionRoomType
  status: PublicEventStatus
  startsAt: string
  endsAt?: string
  timezone: string
  priceInCents: number
  effectivePriceInCents: number
  currency: string
  organizer: { id: string; name: string }
  _count: { tickets: number }
}

export type SeatStatus = 'FREE' | 'HELD' | 'SOLD'

export interface PublicSeatmapRow {
  row: string
  seats: { id: string; number: number; kind: string; status: SeatStatus }[]
}

export interface PublicSeatmap {
  eventId: string
  rows: PublicSeatmapRow[]
  meta: { generatedAt: string; priceInCents: number; effectivePriceInCents: number; currency: string }
}

export interface ListPublicEventsParams {
  page?: number
  limit?: number
  q?: string
  from?: string
  to?: string
  externalId?: string
}

export const catalogKeys = {
  all: ['catalog'] as const,
  list: (params: ListPublicEventsParams) => [...catalogKeys.all, 'list', params] as const,
  detail: (id: string) => [...catalogKeys.all, 'detail', id] as const,
  seatmap: (id: string) => [...catalogKeys.all, 'seatmap', id] as const,
}

export function listPublicEvents(params: ListPublicEventsParams) {
  const search = new URLSearchParams()
  search.set('page', String(params.page ?? 1))
  search.set('limit', String(params.limit ?? 20))
  if (params.q) search.set('q', params.q)
  if (params.from) search.set('from', params.from)
  if (params.to) search.set('to', params.to)
  if (params.externalId) search.set('externalId', params.externalId)
  return api.get<Paginated<PublicEvent>>(`/events?${search.toString()}`)
}

export function getPublicEvent(id: string) {
  return api.get<PublicEvent>(`/events/${id}`)
}

export function getPublicEventSeatmap(id: string) {
  return api.get<PublicSeatmap>(`/events/${id}/seatmap`)
}
