import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { env } from '../../../lib/env'
import { queryClient } from '../../../lib/query-client'
import { server } from '../../../test/msw/server'
import { renderWithProviders } from '../../../test/render'
import TicketListPage from './TicketListPage'

const API = env.VITE_API_URL

function makeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    status: 'ACTIVE',
    usedAt: null,
    createdAt: new Date().toISOString(),
    event: {
      id: 'evt-1',
      title: 'Sessão de teste',
      imageUrl: null,
      startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      endsAt: null,
      timezone: 'America/Sao_Paulo',
      venueName: 'Cine Elite',
      venueCity: 'São Paulo',
    },
    seat: { row: 'A', number: 12 },
    ...overrides,
  }
}

function paginated(data: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    data,
    meta: { page: 1, limit: 20, total: data.length, totalPages: 1, hasNext: false, hasPrev: false, ...overrides },
  }
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/ingressos" element={<TicketListPage />} />
      <Route path="/ingressos/:id" element={<div data-testid="detail-page" />} />
      <Route path="/" element={<div data-testid="home-page" />} />
    </Routes>,
    { initialEntries: ['/ingressos'] },
  )
}

afterEach(() => {
  queryClient.clear()
})

describe('TicketListPage', () => {
  it('agrupa por próximos/passados a partir de startsAt, não do status', async () => {
    const upcoming = makeTicket({ id: 'upcoming', status: 'ACTIVE' })
    const past = makeTicket({
      id: 'past',
      status: 'USED',
      event: {
        ...upcoming.event,
        title: 'Sessão passada',
        startsAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    })
    server.use(http.get(`${API}/tickets`, () => HttpResponse.json(paginated([upcoming, past]))))

    renderPage()

    expect(await screen.findByText('Próximos')).toBeInTheDocument()
    expect(screen.getByText('Passados')).toBeInTheDocument()
    expect(screen.getByText('Sessão de teste')).toBeInTheDocument()
    expect(screen.getByText('Sessão passada')).toBeInTheDocument()
    expect(screen.getByText('Ativo')).toBeInTheDocument()
    expect(screen.getByText('Usado')).toBeInTheDocument()
  })

  it('meia-entrada -- card mostra o badge, ingresso inteira não mostra', async () => {
    const half = makeTicket({ id: 'half', priceType: 'HALF' })
    const full = makeTicket({ id: 'full', priceType: 'FULL', event: { ...half.event, title: 'Sessão inteira' } })
    server.use(http.get(`${API}/tickets`, () => HttpResponse.json(paginated([half, full]))))

    renderPage()

    expect(await screen.findByText('Meia-entrada')).toBeInTheDocument()
    expect(screen.getAllByText('Meia-entrada')).toHaveLength(1) // só o card do ingresso HALF
  })

  it('sem ingressos -- vazio com CTA para o catálogo', async () => {
    server.use(http.get(`${API}/tickets`, () => HttpResponse.json(paginated([]))))

    renderPage()

    expect(await screen.findByText('Você ainda não tem ingressos')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver catálogo' })).toBeInTheDocument()
  })

  it('erro -- mensagem tratada, lista nunca some sem explicação', async () => {
    server.use(
      http.get(`${API}/tickets`, () =>
        HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'Erro interno' }, { status: 500 }),
      ),
    )

    renderPage()

    // 500 aciona 1 retry (query-client.ts) antes do erro aparecer
    expect(await screen.findByText('Erro interno', {}, { timeout: 3000 })).toBeInTheDocument()
  })

  it('clicar num card navega para o detalhe do ingresso', async () => {
    server.use(http.get(`${API}/tickets`, () => HttpResponse.json(paginated([makeTicket({ id: 'abc' })]))))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByText('Sessão de teste'))

    expect(await screen.findByTestId('detail-page')).toBeInTheDocument()
  })

  it('paginação usa a meta do servidor e refaz a busca na página seguinte', async () => {
    server.use(
      http.get(`${API}/tickets`, ({ request }) => {
        const url = new URL(request.url)
        const page = url.searchParams.get('page')
        if (page === '2') {
          return HttpResponse.json(
            paginated([makeTicket({ id: 'p2', event: { ...makeTicket().event, title: 'Sessão página 2' } })], {
              page: 2,
              totalPages: 2,
              hasPrev: true,
              hasNext: false,
            }),
          )
        }
        return HttpResponse.json(paginated([makeTicket({ id: 'p1' })], { totalPages: 2, hasNext: true }))
      }),
    )
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Sessão de teste')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Próxima' }))

    expect(await screen.findByText('Sessão página 2')).toBeInTheDocument()
  })
})
