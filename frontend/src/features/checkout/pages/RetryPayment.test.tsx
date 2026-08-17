import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { env } from '../../../lib/env'
import { queryClient } from '../../../lib/query-client'
import { server } from '../../../test/msw/server'
import { renderWithProviders } from '../../../test/render'
import CheckoutReturnPage from './CheckoutReturnPage'

const API = env.VITE_API_URL

function makeFailedOrder() {
  return {
    id: 'order-1',
    userId: 'u1',
    eventId: 'evt-1',
    status: 'FAILED',
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
      {
        id: 'hold-2',
        seatId: 'seat-a2',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        releasedAt: null,
      },
      {
        id: 'hold-3',
        seatId: 'seat-a3',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        releasedAt: null,
      },
    ],
  }
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/checkout/:orderId/retorno" element={<CheckoutReturnPage />} />
      <Route path="/checkout/:orderId" element={<div data-testid="checkout-page">novo checkout</div>} />
      <Route path="/eventos/:id/assentos" element={<div data-testid="seat-page" />} />
    </Routes>,
    { initialEntries: ['/checkout/order-1/retorno'] },
  )
}

afterEach(() => {
  queryClient.clear()
})

describe('RetryPayment -- "Tentar outro cartão" reaproveita os assentos, não cria um pedido do zero', () => {
  it('recusa -- cria um NOVO pedido (idempotency key nova) com os mesmos holds ainda ativos, e navega para ele', async () => {
    let receivedBody: Record<string, unknown> | null = null
    let receivedIdempotencyKey: string | null = null
    server.use(
      http.get(`${API}/orders/order-1`, () => HttpResponse.json(makeFailedOrder())),
      http.post(`${API}/orders`, async ({ request }) => {
        receivedIdempotencyKey = request.headers.get('idempotency-key')
        receivedBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(
          { order: { ...makeFailedOrder(), id: 'order-2', status: 'PENDING' }, clientSecret: 'pi_fake_secret' },
          { status: 201 },
        )
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Tentar outro cartão' }))

    expect(await screen.findByTestId('checkout-page')).toBeInTheDocument()
    expect(receivedBody).toMatchObject({ eventId: 'evt-1', holdIds: ['seat-a1', 'seat-a2'] })
    expect(receivedIdempotencyKey).toBeTruthy()
  })

  it('recusa -- se o hold expirou de verdade entre a tela carregar e o clique, volta pro mapa em vez de travar num erro sem saída', async () => {
    server.use(
      http.get(`${API}/orders/order-1`, () => HttpResponse.json(makeFailedOrder())),
      http.post(`${API}/orders`, () => HttpResponse.json({ code: 'HOLD_EXPIRED', message: 'expirou' }, { status: 409 })),
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Tentar outro cartão' }))

    expect(await screen.findByTestId('seat-page')).toBeInTheDocument()
  })
})
