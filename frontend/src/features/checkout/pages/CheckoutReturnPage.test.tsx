import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { ToastProvider } from '../../../components'
import { env } from '../../../lib/env'
import { queryClient } from '../../../lib/query-client'
import { server } from '../../../test/msw/server'
import CheckoutReturnPage from './CheckoutReturnPage'

const API = env.VITE_API_URL

// Polling é de 1s x até 3 tentativas -- os testes que dependem disso precisam de
// mais tempo que o default do Vitest/findBy*.
const POLLING_TEST_TIMEOUT = 8000

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    userId: 'u1',
    eventId: 'evt-1',
    status: 'PENDING',
    amountInCents: 6400,
    currency: 'BRL',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    holds: [
      {
        id: 'hold-1',
        seatId: 'seat-a1',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        releasedAt: null,
      },
    ],
    ...overrides,
  }
}

function renderPage(orderId = 'order-1') {
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/checkout/${orderId}/retorno`]}>
          <Routes>
            <Route path="/checkout/:orderId/retorno" element={<CheckoutReturnPage />} />
            <Route path="/checkout/:orderId" element={<div data-testid="checkout-page" />} />
            <Route path="/eventos/:id/assentos" element={<div data-testid="seat-page" />} />
            <Route path="/ingressos" element={<div data-testid="tickets-page" />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  queryClient.clear()
})

describe('CheckoutReturnPage', () => {
  it('PAID -- tela aprovada com CTA para meus ingressos', async () => {
    server.use(http.get(`${API}/orders/order-1`, () => HttpResponse.json(makeOrder({ status: 'PAID' }))))
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Pagamento aprovado')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Ver meus ingressos' }))
    expect(await screen.findByTestId('tickets-page')).toBeInTheDocument()
  })

  it('FAILED com hold ainda ativo -- tela de recusa oferece "Tentar outro cartão"', async () => {
    server.use(http.get(`${API}/orders/order-1`, () => HttpResponse.json(makeOrder({ status: 'FAILED' }))))
    renderPage()

    expect(await screen.findByText('Pagamento recusado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar outro cartão' })).toBeInTheDocument()
  })

  it('FAILED sem hold ativo (já expirou) -- oferece escolher assentos de novo, não "tentar de novo"', async () => {
    server.use(
      http.get(`${API}/orders/order-1`, () =>
        HttpResponse.json(
          makeOrder({
            status: 'FAILED',
            holds: [
              {
                id: 'hold-1',
                seatId: 'seat-a1',
                expiresAt: new Date(Date.now() - 1000).toISOString(),
                releasedAt: null,
              },
            ],
          }),
        ),
      ),
    )
    renderPage()

    expect(await screen.findByText('Pagamento recusado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tentar outro cartão' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Escolher assentos de novo' })).toBeInTheDocument()
  })

  it('EXPIRED -- mensagem de sessão de pagamento expirada', async () => {
    server.use(http.get(`${API}/orders/order-1`, () => HttpResponse.json(makeOrder({ status: 'EXPIRED' }))))
    renderPage()

    expect(await screen.findByText('O tempo para pagar esgotou')).toBeInTheDocument()
  })

  it(
    'PENDING -- faz polling e mostra a tela aprovada quando o status muda para PAID',
    async () => {
      let callCount = 0
      server.use(
        http.get(`${API}/orders/order-1`, () => {
          callCount += 1
          return HttpResponse.json(makeOrder({ status: callCount >= 2 ? 'PAID' : 'PENDING' }))
        }),
      )
      renderPage()

      expect(await screen.findByText('Confirmando seu pagamento…')).toBeInTheDocument()
      expect(await screen.findByText('Pagamento aprovado', {}, { timeout: 6000 })).toBeInTheDocument()
      expect(callCount).toBeGreaterThanOrEqual(2)
    },
    POLLING_TEST_TIMEOUT,
  )

  it(
    'PENDING sem confirmar depois de 3 tentativas -- tela neutra, nunca sugere falha',
    async () => {
      server.use(http.get(`${API}/orders/order-1`, () => HttpResponse.json(makeOrder({ status: 'PENDING' }))))
      renderPage()

      expect(
        await screen.findByText('Estamos confirmando seu pagamento', {}, { timeout: 6000 }),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Verificar novamente' })).toBeInTheDocument()
      expect(screen.queryByText(/erro/i)).not.toBeInTheDocument()
    },
    POLLING_TEST_TIMEOUT,
  )
})
