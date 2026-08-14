import { api, type Paginated } from '../../lib/api'
import type { SessionAudio, SessionFormat, SessionRoomType } from '../../shared/session-attributes'

export type PublicEventStatus = 'PUBLISHED' | 'CANCELLED'

// Formato que a listagem/detalhe pública recebe -- mesmo endpoint `GET /events` do
// organizador (etapa 04), sem `status` no query: o back já assume `PUBLISHED` por
// padrão (events.schema.ts) e nunca devolve `DRAFT`/`CANCELLED` para quem não é o
// dono (events.service.ts, `isVisibleTo`) -- não repetimos essa checagem aqui, só
// aceitamos o que a API decide mostrar.
export interface PublicEvent {
  id: string
  // mesmo filme do catálogo TMDb (`@@index([source, externalId])` no back) -- usado
  // pra buscar as OUTRAS sessões do mesmo filme na tela de detalhe (ver
  // `listPublicEvents({ externalId })`), não exibido diretamente em nenhuma tela
  source: string
  externalId: string
  title: string
  subtitle?: string
  synopsis?: string
  imageUrl?: string
  runtimeMinutes?: number
  genres: string[]
  // classificação indicativa BR ("L", "10", "12", "14", "16", "18") -- snapshot do
  // TMDb feito na criação do evento, ausente quando o TMDb não tinha essa entrada
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
  if (params.externalId) search.set('externalId', params.externalId)
  return api.get<Paginated<PublicEvent>>(`/events?${search.toString()}`)
}

export function getPublicEvent(id: string) {
  return api.get<PublicEvent>(`/events/${id}`)
}

export function getPublicEventSeatmap(id: string) {
  return api.get<PublicSeatmap>(`/events/${id}/seatmap`)
}
