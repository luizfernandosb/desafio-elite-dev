import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { env } from '../../../lib/env'
import { queryClient } from '../../../lib/query-client'
import { server } from '../../../test/msw/server'
import SharedTicketPage from './SharedTicketPage'

const API = env.VITE_API_URL

function renderAt(shareToken: string) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/share/${shareToken}`]}>
        <Routes>
          <Route path="/share/:shareToken" element={<SharedTicketPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  queryClient.clear()
})

describe('SharedTicketPage', () => {
  it('renderiza pôster, evento, assento e QR a partir da resposta pública mínima -- sem email/name/userId', async () => {
    server.use(
      http.get(`${API}/share/token-abc`, () =>
        HttpResponse.json({
          event: {
            title: 'Duna: Parte Dois',
            imageUrl: null,
            startsAt: new Date(Date.now() + 3600_000).toISOString(),
            timezone: 'America/Sao_Paulo',
            venueName: 'Cine Elite',
            venueCity: 'São Paulo',
          },
          seat: { row: 'A', number: 12 },
          ticket: { code: 'TKT1.payload.signature', status: 'ACTIVE' },
        }),
      ),
    )

    const { container } = renderAt('token-abc')

    expect(await screen.findByText('Duna: Parte Dois')).toBeInTheDocument()
    expect(screen.getByText('Fileira A, assento 12')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
    // nunca mostra nada de quem comprou -- o back já não envia, mas a tela também não presume
    expect(screen.queryByText(/@/)).not.toBeInTheDocument()
  })

  it('USED -- QR continua no DOM, com o selo de já utilizado', async () => {
    server.use(
      http.get(`${API}/share/token-abc`, () =>
        HttpResponse.json({
          event: {
            title: 'Duna: Parte Dois',
            imageUrl: null,
            startsAt: new Date(Date.now() + 3600_000).toISOString(),
            timezone: 'America/Sao_Paulo',
            venueName: 'Cine Elite',
            venueCity: 'São Paulo',
          },
          seat: { row: 'A', number: 12 },
          ticket: { code: 'TKT1.payload.signature', status: 'USED' },
        }),
      ),
    )

    const { container } = renderAt('token-abc')

    expect(await screen.findByText('Já utilizado')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it.each([
    ['SHARE_EXPIRED', 410, 'Este link não está mais disponível.'],
    ['SHARE_REVOKED', 410, 'Este link não está mais disponível.'],
    ['SHARE_NOT_FOUND', 404, 'Link inválido.'],
    ['TICKET_CANCELLED', 410, 'Este ingresso foi cancelado.'],
  ])('%s -- mensagem humana, nunca código técnico nem JSON cru', async (code, status, expected) => {
    server.use(
      http.get(`${API}/share/token-abc`, () => HttpResponse.json({ code, message: code }, { status })),
    )

    renderAt('token-abc')

    expect(await screen.findByText(expected)).toBeInTheDocument()
  })
})
