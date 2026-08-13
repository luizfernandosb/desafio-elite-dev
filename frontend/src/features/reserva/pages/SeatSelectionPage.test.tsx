import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from '../../../lib/env'
import { queryClient } from '../../../lib/query-client'
import { server } from '../../../test/msw/server'
import { renderWithProviders } from '../../../test/render'
import SeatSelectionPage from './SeatSelectionPage'

// Mock do cliente Supabase -- os testes desta página não devem depender de rede de
// verdade (§ etapa 07); `useSeatRealtime`/`usePollingFallback` são testados a fundo
// em isolamento nos próprios arquivos. Aqui só garantimos que a página monta o canal,
// mostra "ao vivo" quando conecta, e aplica um patch recebido sem quebrar o resto do
// fluxo -- `postgresChangesCallback` guardado para os testes disparem um patch à mão.
let postgresChangesCallback: ((payload: { new: Record<string, unknown> }) => void) | undefined
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    channel: () => ({
      on: (_event: string, _filter: unknown, callback: (payload: { new: Record<string, unknown> }) => void) => {
        postgresChangesCallback = callback
        return { subscribe: (statusCallback?: (status: string) => void) => statusCallback?.('SUBSCRIBED') }
      },
    }),
    removeChannel: vi.fn(),
  },
}))

const API = env.VITE_API_URL

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    title: 'Duna: Parte Dois',
    venueName: 'Cine Elite',
    venueCity: 'São Paulo',
    status: 'PUBLISHED',
    startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    timezone: 'America/Sao_Paulo',
    priceInCents: 3200,
    currency: 'BRL',
    ...overrides,
  }
}

function makeSeatmap() {
  return {
    eventId: 'evt-1',
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
    meta: { generatedAt: new Date().toISOString(), priceInCents: 3200, currency: 'BRL' },
  }
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/eventos/:id/assentos" element={<SeatSelectionPage />} />
      <Route path="/checkout/:orderId" element={<div data-testid="checkout-page" />} />
    </Routes>,
    { initialEntries: ['/eventos/evt-1/assentos'] },
  )
}

function mockEventAndSeatmap(eventOverrides: Record<string, unknown> = {}) {
  server.use(
    http.get(`${API}/events/evt-1`, () => HttpResponse.json(makeEvent(eventOverrides))),
    http.get(`${API}/events/evt-1/seatmap`, () => HttpResponse.json(makeSeatmap())),
  )
}

afterEach(() => {
  queryClient.clear()
})

describe('SeatSelectionPage', () => {
  it('seleciona um assento livre -- barra mostra o rótulo e o preço total', async () => {
    mockEventAndSeatmap()
    const user = userEvent.setup()
    renderPage()

    const seatA1 = await screen.findByLabelText('Assento A1, disponível')
    await user.click(seatA1)

    expect(await screen.findByText('A1')).toBeInTheDocument()
    expect(screen.getByText('R$ 32,00')).toBeInTheDocument()
  })

  it('201 -- barra troca para o cronômetro; "Ir para pagamento" navega ao checkout', async () => {
    server.use(
      http.post(`${API}/events/evt-1/holds`, () =>
        HttpResponse.json(
          {
            data: [
              {
                id: 'hold-1',
                eventId: 'evt-1',
                seatId: 'seat-a1',
                userId: 'u1',
                expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
              },
            ],
          },
          { status: 201 },
        ),
      ),
    )
    mockEventAndSeatmap()
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByLabelText('Assento A1, disponível'))
    await user.click(screen.getByRole('button', { name: 'Reservar por 10 minutos' }))

    const proceedButton = await screen.findByRole('button', { name: 'Ir para pagamento' })
    await user.click(proceedButton)

    expect(await screen.findByTestId('checkout-page')).toBeInTheDocument()
  })

  it('409 SEAT_TAKEN -- remove só o assento indicado pelo servidor e avisa por toast', async () => {
    let call = 0
    server.use(
      http.post(`${API}/events/evt-1/holds`, () => {
        call += 1
        return HttpResponse.json(
          { code: 'SEAT_TAKEN', message: 'Assento já reservado', takenSeatIds: ['seat-a2'] },
          { status: 409 },
        )
      }),
    )
    mockEventAndSeatmap()
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByLabelText('Assento A1, disponível'))
    await user.click(await screen.findByLabelText('Assento A2, disponível'))
    await user.click(screen.getByRole('button', { name: 'Reservar por 10 minutos' }))

    expect(await screen.findByText(/Alguém reservou/)).toBeInTheDocument()
    expect(call).toBe(1)
    // A1 continua selecionado (não fazia parte de takenSeatIds); a barra ainda mostra
    // o rótulo e o preço de 1 assento só -- A2 saiu da seleção
    expect(await screen.findByText('A1')).toBeInTheDocument()
    expect(screen.queryByText('A1, A2')).not.toBeInTheDocument()
  })

  it('7º assento clicado -- mensagem, sem chamar a API', async () => {
    const seatmapWithManySeats = {
      eventId: 'evt-1',
      rows: [
        {
          row: 'A',
          seats: Array.from({ length: 7 }, (_, i) => ({
            id: `seat-a${i + 1}`,
            number: i + 1,
            kind: 'REGULAR',
            status: 'FREE',
          })),
        },
      ],
      meta: { generatedAt: new Date().toISOString(), priceInCents: 3200, currency: 'BRL' },
    }
    let holdCalls = 0
    server.use(
      http.get(`${API}/events/evt-1`, () => HttpResponse.json(makeEvent())),
      http.get(`${API}/events/evt-1/seatmap`, () => HttpResponse.json(seatmapWithManySeats)),
      http.post(`${API}/events/evt-1/holds`, () => {
        holdCalls += 1
        return HttpResponse.json({ data: [] }, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderPage()

    for (let i = 1; i <= 6; i++) {
      await user.click(await screen.findByLabelText(`Assento A${i}, disponível`))
    }
    await user.click(await screen.findByLabelText('Assento A7, disponível'))

    // aparece duas vezes -- na barra (hint de "atMax") e no toast de aviso; ambos
    // são o sinal de "sua última ação não teve efeito" (§ etapa 06)
    await vi.waitFor(() => expect(screen.getAllByText('Máximo de 6 assentos por reserva.')).toHaveLength(2))
    expect(holdCalls).toBe(0)
    expect(screen.queryByLabelText('Assento A7, disponível, selecionado')).not.toBeInTheDocument()
  })

  it('sessão já ocorrida -- mostra aviso em vez do mapa, sem permitir reserva', async () => {
    mockEventAndSeatmap({ startsAt: '2020-01-01T12:00:00.000Z' })
    renderPage()

    expect(await screen.findByText('Esta sessão não está mais disponível para reserva')).toBeInTheDocument()
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  })

  it('canal conectado -- badge mostra "Ao vivo"', async () => {
    mockEventAndSeatmap()
    renderPage()

    expect(await screen.findByText('Ao vivo')).toBeInTheDocument()
  })

  it('patch do Realtime (outro usuário vendendo A2) atualiza o mapa sem nenhuma ação do cliente', async () => {
    mockEventAndSeatmap()
    renderPage()

    await screen.findByLabelText('Assento A2, disponível')
    expect(postgresChangesCallback).toBeDefined()

    postgresChangesCallback?.({ new: { seatId: 'seat-a2', eventId: 'evt-1', status: 'SOLD', expiresAt: null } })

    expect(await screen.findByLabelText('Assento A2, vendido')).toBeInTheDocument()
  })
})
