import { api, type Paginated } from '../../lib/api'
import type { SessionAudio, SessionFormat, SessionRoomType } from '../../shared/session-attributes'

export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED'
export type SeatKind = 'REGULAR' | 'ACCESSIBLE' | 'COMPANION'
export type SeatStatus = 'FREE' | 'HELD' | 'SOLD'

export interface CatalogItem {
  source: 'TMDB'
  externalId: string
  title: string
  subtitle?: string
  synopsis?: string
  imageUrl?: string
  runtimeMinutes?: number
  genres: string[]
}

// TMDb pagina em blocos fixos de 20, sem `limit` configurável (§4.3, backend
// catalog.schema.ts) -- `meta.stale` só aparece quando o back serve cache vencido
// após falha do provedor (bugs.md não cobre isto, mas catalog.service.ts sim).
export interface CatalogSearchResult extends Paginated<CatalogItem> {
  meta: Paginated<CatalogItem>['meta'] & { stale?: boolean }
}

export interface StateOption {
  id: number
  sigla: string
  nome: string
}

export interface CityOption {
  id: number
  nome: string
}

export interface OrganizerEvent {
  id: string
  organizerId: string
  source: 'TMDB'
  externalId: string
  title: string
  subtitle?: string
  synopsis?: string
  imageUrl?: string
  catalogImageUrl?: string
  customImageKey?: string | null
  runtimeMinutes?: number
  genres: string[]
  ageRating?: string
  venueName: string
  venueCity: string
  venueState: string
  format: SessionFormat
  audio: SessionAudio
  roomType: SessionRoomType
  vipSurchargePercent: number | null
  type: 'SEATED'
  status: EventStatus
  startsAt: string
  endsAt?: string
  timezone: string
  priceInCents: number
  effectivePriceInCents: number
  currency: string
  createdAt: string
  updatedAt: string
  organizer: { id: string; name: string }
  _count: { tickets: number }
}

export interface EventSeatmapSeat {
  id: string
  number: number
  kind: SeatKind
  status: SeatStatus
}

export interface EventSeatmapRow {
  row: string
  seats: EventSeatmapSeat[]
}

export interface EventSeatmap {
  eventId: string
  rows: EventSeatmapRow[]
  meta: { generatedAt: string; priceInCents: number; effectivePriceInCents: number; currency: string }
}

export interface CreateEventInput {
  source: 'TMDB'
  externalId: string
  venueName: string
  venueCity: string
  venueState: string
  startsAt: string // ISO -- o back faz `z.coerce.date()`, aceita string
  endsAt?: string
  timezone: string
  priceInCents: number
  layout: {
    rows: number
    seatsPerRow: number
    accessibleSeats?: string[]
  }
  // sem default aqui -- o back já assume 2D/Dublado/Padrão se nada vier (events.schema.ts)
  format?: SessionFormat
  audio?: SessionAudio
  roomType?: SessionRoomType
  vipSurchargePercent?: number
}

// campos bloqueados após a primeira venda (SALE_LOCKED_FIELDS no back) já ficam de
// fora do formulário quando `event._count.tickets > 0` -- ver EventEditForm.tsx
export interface UpdateEventInput {
  venueName?: string
  synopsis?: string
  venueCity?: string
  venueState?: string
  startsAt?: string
  endsAt?: string
  timezone?: string
  priceInCents?: number
  format?: SessionFormat
  audio?: SessionAudio
  roomType?: SessionRoomType
  vipSurchargePercent?: number | null
}

export interface ListOrganizerEventsParams {
  status: EventStatus
  page?: number
  limit?: number
  q?: string
}

export const organizadorKeys = {
  all: ['organizador'] as const,
  catalogSearch: (q: string, page: number) => [...organizadorKeys.all, 'catalog-search', q, page] as const,
  events: () => [...organizadorKeys.all, 'events'] as const,
  eventList: (params: ListOrganizerEventsParams) => [...organizadorKeys.events(), 'list', params] as const,
  eventDetail: (id: string) => [...organizadorKeys.events(), 'detail', id] as const,
  eventSeatmap: (id: string) => [...organizadorKeys.events(), 'seatmap', id] as const,
  states: () => [...organizadorKeys.all, 'locations', 'states'] as const,
  cities: (uf: string) => [...organizadorKeys.all, 'locations', 'states', uf, 'cities'] as const,
}

export function searchCatalog(q: string, page = 1) {
  const search = new URLSearchParams({ q, page: String(page) })
  return api.get<CatalogSearchResult>(`/catalog/search?${search.toString()}`)
}

// estados e municípios do IBGE não mudam de um dia para o outro -- só o back cacheia
// (locations.service.ts); aqui é só o `unwrap` do envelope `{ data }` de resposta
export function getStates() {
  return api.get<{ data: StateOption[] }>('/locations/states').then((res) => res.data)
}

export function getCities(uf: string) {
  return api.get<{ data: CityOption[] }>(`/locations/states/${uf}/cities`).then((res) => res.data)
}

export function listOrganizerEvents(params: ListOrganizerEventsParams) {
  const search = new URLSearchParams({
    status: params.status,
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
  })
  if (params.q) search.set('q', params.q)
  return api.get<Paginated<OrganizerEvent>>(`/events?${search.toString()}`)
}

export function getEvent(id: string) {
  return api.get<OrganizerEvent>(`/events/${id}`)
}

export function getEventSeatmap(id: string) {
  return api.get<EventSeatmap>(`/events/${id}/seatmap`)
}

export function createEvent(input: CreateEventInput) {
  return api.post<OrganizerEvent>('/events', input)
}

export function updateEvent(id: string, input: UpdateEventInput) {
  return api.patch<OrganizerEvent>(`/events/${id}`, input)
}

export function publishEvent(id: string) {
  return api.post<OrganizerEvent>(`/events/${id}/publish`)
}

export function cancelEvent(id: string) {
  return api.post<OrganizerEvent>(`/events/${id}/cancel`)
}

export function deleteEvent(id: string) {
  return api.delete<void>(`/events/${id}`)
}

export function uploadEventImage(id: string, file: File) {
  const formData = new FormData()
  formData.append('image', file)
  return api.post<OrganizerEvent>(`/events/${id}/image`, formData)
}

export function removeEventImage(id: string) {
  return api.delete<OrganizerEvent>(`/events/${id}/image`)
}
