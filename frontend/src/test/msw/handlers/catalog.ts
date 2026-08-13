import { http, HttpResponse } from 'msw'
import { env } from '../../../lib/env'
import type { PublicEvent, PublicSeatmap } from '../../../features/catalog/api'

const API = env.VITE_API_URL

// Uma sessão publicada, no futuro, com poucos assentos livres -- serve tanto a
// leitura pública (catálogo, detalhe do evento) quanto o mapa de assentos
// (`reserva/api.ts` bate nos MESMOS dois endpoints de evento/seatmap, § etapa 06)
// e o seletor de sessão da portaria (`EventPicker`, reaproveita `GET /events`).
export const DEFAULT_EVENT: PublicEvent = {
  id: 'evt-1',
  title: 'Duna: Parte Dois',
  subtitle: '2024',
  imageUrl: 'https://image.tmdb.org/duna.jpg',
  genres: ['Ficção científica'],
  venueName: 'Cine Elite',
  venueCity: 'São Paulo',
  format: 'TWO_D',
  audio: 'DUBBED',
  roomType: 'STANDARD',
  status: 'PUBLISHED',
  startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  timezone: 'America/Sao_Paulo',
  priceInCents: 3200,
  effectivePriceInCents: 3200,
  currency: 'BRL',
  organizer: { id: 'org-1', name: 'Ana' },
  _count: { tickets: 0 },
}

export const DEFAULT_SEATMAP: PublicSeatmap = {
  eventId: DEFAULT_EVENT.id,
  rows: [
    {
      row: 'A',
      seats: [
        { id: 'seat-a1', number: 1, kind: 'REGULAR', status: 'FREE' },
        { id: 'seat-a2', number: 2, kind: 'REGULAR', status: 'FREE' },
        { id: 'seat-a3', number: 3, kind: 'REGULAR', status: 'SOLD' },
      ],
    },
  ],
  meta: {
    generatedAt: new Date().toISOString(),
    priceInCents: DEFAULT_EVENT.priceInCents,
    effectivePriceInCents: DEFAULT_EVENT.effectivePriceInCents,
    currency: 'BRL',
  },
}

export const catalogHandlers = [
  http.get(`${API}/events`, () =>
    HttpResponse.json({
      data: [DEFAULT_EVENT],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    }),
  ),
  http.get(`${API}/events/:id`, ({ params }) =>
    params.id === DEFAULT_EVENT.id
      ? HttpResponse.json(DEFAULT_EVENT)
      : HttpResponse.json({ code: 'NOT_FOUND', message: 'Sessão não encontrada' }, { status: 404 }),
  ),
  http.get(`${API}/events/:id/seatmap`, ({ params }) =>
    params.id === DEFAULT_EVENT.id
      ? HttpResponse.json(DEFAULT_SEATMAP)
      : HttpResponse.json({ code: 'NOT_FOUND', message: 'Sessão não encontrada' }, { status: 404 }),
  ),
]
