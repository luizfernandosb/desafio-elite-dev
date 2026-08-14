import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { env } from '../../../lib/env'
import { queryClient } from '../../../lib/query-client'
import { server } from '../../../test/msw/server'
import { renderWithProviders } from '../../../test/render'
import TicketDetailPage from './TicketDetailPage'

const API = env.VITE_API_URL

function makeTicketDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-1',
    status: 'ACTIVE',
    usedAt: null,
    createdAt: new Date().toISOString(),
    code: 'TKT1.payload.signature',
    event: {
      id: 'evt-1',
      title: 'Duna: Parte Dois',
      imageUrl: null,
      startsAt: new Date(Date.now() + 3600_000).toISOString(),
      endsAt: null,
      timezone: 'America/Sao_Paulo',
      venueName: 'Cine Elite',
      venueCity: 'São Paulo',
    },
    seat: { row: 'A', number: 12 },
    ...overrides,
  }
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/ingressos/:id" element={<TicketDetailPage />} />
      <Route path="/ingressos" element={<div data-testid="list-page" />} />
    </Routes>,
    { initialEntries: ['/ingressos/ticket-1'] },
  )
}

afterEach(() => {
  queryClient.clear()
})

describe('TicketDetailPage', () => {
  it('ACTIVE -- renderiza o QR a partir de code, sem esmaecer, com o código selecionável em texto', async () => {
    server.use(http.get(`${API}/tickets/ticket-1`, () => HttpResponse.json(makeTicketDetail())))

    const { container } = renderPage()

    expect(await screen.findByText('Duna: Parte Dois')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(screen.getByText('TKT1.payload.signature')).toBeInTheDocument()
    expect(screen.getByText('Ativo')).toBeInTheDocument()
    expect(screen.queryByText(/Já utilizado/)).not.toBeInTheDocument()
  })

  it('USED -- QR continua no DOM (nunca escondido), com selo de já utilizado', async () => {
    server.use(
      http.get(`${API}/tickets/ticket-1`, () =>
        HttpResponse.json(makeTicketDetail({ status: 'USED', usedAt: new Date().toISOString() })),
      ),
    )

    const { container } = renderPage()

    expect(await screen.findByText('Usado')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(screen.getByText(/Já utilizado/)).toBeInTheDocument()
  })

  it('CANCELLED -- não renderiza QR nem código, mostra mensagem de cancelamento', async () => {
    server.use(http.get(`${API}/tickets/ticket-1`, () => HttpResponse.json(makeTicketDetail({ status: 'CANCELLED' }))))

    const { container } = renderPage()

    expect(await screen.findByText('Cancelado')).toBeInTheDocument()
    expect(container.querySelector('svg')).not.toBeInTheDocument()
    expect(screen.queryByText('TKT1.payload.signature')).not.toBeInTheDocument()
    expect(screen.getByText(/Este ingresso foi cancelado/)).toBeInTheDocument()
  })

  it('meia-entrada -- mostra o badge e o lembrete de apresentar documento', async () => {
    server.use(http.get(`${API}/tickets/ticket-1`, () => HttpResponse.json(makeTicketDetail({ priceType: 'HALF' }))))

    renderPage()

    expect(await screen.findByText('Meia-entrada')).toBeInTheDocument()
    expect(screen.getByText(/apresente documento comprobatório/)).toBeInTheDocument()
  })

  it('ingresso inteira -- não mostra badge nem lembrete de meia-entrada', async () => {
    server.use(http.get(`${API}/tickets/ticket-1`, () => HttpResponse.json(makeTicketDetail({ priceType: 'FULL' }))))

    renderPage()

    await screen.findByText('Duna: Parte Dois')
    expect(screen.queryByText('Meia-entrada')).not.toBeInTheDocument()
  })

  it('ingresso inexistente -- vazio com link de volta, nunca stack trace', async () => {
    server.use(
      http.get(`${API}/tickets/ticket-1`, () =>
        HttpResponse.json({ code: 'NOT_FOUND', message: 'Não encontramos esse ingresso' }, { status: 404 }),
      ),
    )

    renderPage()

    expect(await screen.findByText('Não encontramos esse ingresso')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para meus ingressos' })).toBeInTheDocument()
  })
})
