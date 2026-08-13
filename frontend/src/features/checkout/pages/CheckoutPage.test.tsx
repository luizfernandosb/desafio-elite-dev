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
import CheckoutPage from './CheckoutPage'

const API = env.VITE_API_URL

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
      { id: 'hold-1', seatId: 'seat-a1', releasedAt: null },
      { id: 'hold-2', seatId: 'seat-a2', releasedAt: null },
    ],
    ...overrides,
  }
}

function renderAt(initialEntry: { pathname: string; state?: unknown }) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/checkout/:orderId" element={<CheckoutPage />} />
            <Route path="/checkout/:orderId/retorno" element={<div data-testid="retorno-page" />} />
            <Route path="/eventos/:id/assentos" element={<div data-testid="seat-page" />} />
            <Route path="/" element={<div data-testid="home-page" />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  queryClient.clear()
})

describe('CheckoutPage -- criação do pedido', () => {
  it('entra vindo do mapa (eventId + holdIds no state) -- cria o pedido com Idempotency-Key e navega para a URL real', async () => {
    let receivedHeader: string | null = null
    let receivedBody: Record<string, unknown> | null = null
    server.use(
      http.post(`${API}/orders`, async ({ request }) => {
        receivedHeader = request.headers.get('idempotency-key')
        receivedBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(
          { order: makeOrder(), clientSecret: 'pi_fake_secret' },
          { status: 201 },
        )
      }),
      http.get(`${API}/orders/order-1`, () => HttpResponse.json(makeOrder())),
    )

    renderAt({ pathname: '/checkout/novo', state: { eventId: 'evt-1', holdIds: ['hold-1', 'hold-2'] } })

    expect(await screen.findByText('Pagamento')).toBeInTheDocument()
    expect(receivedHeader).toBeTruthy()
    expect(receivedBody).toMatchObject({ eventId: 'evt-1', holdIds: ['hold-1', 'hold-2'] })
  })

  it('sem eventId/holdIds no state -- mostra "sessão de checkout inválida", nunca chama a API', async () => {
    let called = false
    server.use(http.post(`${API}/orders`, () => { called = true; return HttpResponse.json({}, { status: 201 }) }))

    renderAt({ pathname: '/checkout/novo' })

    expect(await screen.findByText('Sessão de checkout inválida')).toBeInTheDocument()
    expect(called).toBe(false)
  })

  it('HOLD_EXPIRED na criação -- volta para o mapa de assentos com um aviso, não um erro solto', async () => {
    server.use(
      http.post(`${API}/orders`, () =>
        HttpResponse.json({ code: 'HOLD_EXPIRED', message: 'expirou' }, { status: 409 }),
      ),
    )

    renderAt({ pathname: '/checkout/novo', state: { eventId: 'evt-1', holdIds: ['hold-1'] } })

    expect(await screen.findByTestId('seat-page')).toBeInTheDocument()
  })
})

describe('CheckoutPage -- formulário de pagamento (fase fake)', () => {
  it('pedido PENDING existente -- mostra o total e o painel de cartões de teste', async () => {
    server.use(http.get(`${API}/orders/order-1`, () => HttpResponse.json(makeOrder())))

    renderAt({ pathname: '/checkout/order-1' })

    expect(await screen.findByText('Total: R$ 64,00')).toBeInTheDocument()
    expect(screen.getByText('4242 4242 4242 4242')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pagar R\$\s?64,00/ })).toBeInTheDocument()
  })

  it('aprovar -- chama simulate-payment com succeeded e navega para o retorno', async () => {
    let receivedBody: Record<string, unknown> | null = null
    server.use(
      http.get(`${API}/orders/order-1`, () => HttpResponse.json(makeOrder())),
      http.post(`${API}/orders/order-1/simulate-payment`, async ({ request }) => {
        receivedBody = (await request.json()) as Record<string, unknown>
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    renderAt({ pathname: '/checkout/order-1' })

    await user.click(await screen.findByRole('button', { name: /Pagar/ }))

    expect(await screen.findByTestId('retorno-page')).toBeInTheDocument()
    expect(receivedBody).toEqual({ outcome: 'succeeded' })
  })

  it('pedido já resolvido (PAID) -- redireciona direto para o retorno, sem mostrar o formulário', async () => {
    server.use(http.get(`${API}/orders/order-1`, () => HttpResponse.json(makeOrder({ status: 'PAID' }))))

    renderAt({ pathname: '/checkout/order-1' })

    expect(await screen.findByTestId('retorno-page')).toBeInTheDocument()
  })
})
