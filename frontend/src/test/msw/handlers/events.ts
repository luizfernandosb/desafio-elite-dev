import { http, HttpResponse } from 'msw'
import { env } from '../../../lib/env'
import type { CatalogSearchResult, OrganizerEvent } from '../../../features/organizador/api'

const API = env.VITE_API_URL

// Lado ORGANIZADOR (criação/edição/publicação, § etapa 04) -- as leituras
// públicas (`GET /events`, `GET /events/:id`, `GET /events/:id/seatmap`) já têm
// default em `catalog.ts`; registrar os dois aqui de novo colidiria na mesma rota
// (MSW usa o primeiro handler que casa). Cada teste de organizador que hoje já
// sobrescreve `POST /events`/`PATCH /events/:id` continua funcionando igual --
// `server.use` sempre tem prioridade sobre estes defaults.
function makeOrganizerEvent(overrides: Partial<OrganizerEvent> = {}): OrganizerEvent {
  return {
    id: 'evt-organizador-1',
    organizerId: 'user-organizador',
    source: 'TMDB',
    externalId: '438631',
    title: 'Duna',
    genres: ['Ficção científica'],
    venueName: 'Cine Elite',
    venueCity: 'São Paulo',
    venueState: 'SP',
    format: 'TWO_D',
    audio: 'DUBBED',
    roomType: 'STANDARD',
    vipSurchargePercent: null,
    type: 'SEATED',
    status: 'DRAFT',
    startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    timezone: 'America/Sao_Paulo',
    priceInCents: 3200,
    effectivePriceInCents: 3200,
    currency: 'BRL',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    organizer: { id: 'user-organizador', name: 'Organizador Teste' },
    _count: { tickets: 0 },
    ...overrides,
  }
}

export const eventsHandlers = [
  http.get(`${API}/catalog/search`, () =>
    HttpResponse.json({
      data: [
        {
          source: 'TMDB',
          externalId: '438631',
          title: 'Duna',
          genres: ['Ficção científica'],
          imageUrl: 'https://image.tmdb.org/duna.jpg',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    } satisfies CatalogSearchResult),
  ),

  http.post(`${API}/events`, async ({ request }) => {
    const body = (await request.json()) as Partial<OrganizerEvent>
    return HttpResponse.json(makeOrganizerEvent(body), { status: 201 })
  }),

  http.patch(`${API}/events/:id`, async ({ params, request }) => {
    const body = (await request.json()) as Partial<OrganizerEvent>
    return HttpResponse.json(makeOrganizerEvent({ id: params.id as string, ...body }))
  }),

  http.post(`${API}/events/:id/publish`, ({ params }) =>
    HttpResponse.json(makeOrganizerEvent({ id: params.id as string, status: 'PUBLISHED' })),
  ),

  http.post(`${API}/events/:id/cancel`, ({ params }) =>
    HttpResponse.json(makeOrganizerEvent({ id: params.id as string, status: 'CANCELLED' })),
  ),
]
