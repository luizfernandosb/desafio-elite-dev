import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { env } from '../../../lib/env'
import { queryClient } from '../../../lib/query-client'
import { server } from '../../../test/msw/server'
import { renderWithProviders } from '../../../test/render'
import { ShareButton } from './ShareButton'

const API = env.VITE_API_URL

afterEach(() => {
  queryClient.clear()
})

function renderButton() {
  return renderWithProviders(<ShareButton ticketId="ticket-1" />)
}

describe('ShareButton', () => {
  it('mostra a semântica antes de qualquer clique, não só depois de gerar o link', () => {
    renderButton()
    expect(screen.getByText(/Quem abrir o link consegue entrar com este ingresso/)).toBeInTheDocument()
  })

  it('gera o link e mostra a validade -- sem navigator.share, cai em copiar', async () => {
    const expiresAt = new Date(Date.now() + 6 * 3600_000).toISOString()
    server.use(
      http.post(`${API}/tickets/ticket-1/share`, () =>
        HttpResponse.json({ url: 'http://localhost:5173/share/abc123', expiresAt }, { status: 201 }),
      ),
    )
    const user = userEvent.setup()
    renderButton()

    await user.click(screen.getByRole('button', { name: 'Compartilhar' }))

    expect(await screen.findByText('http://localhost:5173/share/abc123')).toBeInTheDocument()
    expect(screen.getByText(/Link válido até/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copiar link' })).toBeInTheDocument()
  })

  it('copiar link -- usa a área de transferência e mostra o toast de confirmação', async () => {
    server.use(
      http.post(`${API}/tickets/ticket-1/share`, () =>
        HttpResponse.json(
          { url: 'http://localhost:5173/share/abc123', expiresAt: new Date(Date.now() + 3600_000).toISOString() },
          { status: 201 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderButton()

    await user.click(screen.getByRole('button', { name: 'Compartilhar' }))
    await user.click(await screen.findByRole('button', { name: 'Copiar link' }))

    expect(await navigator.clipboard.readText()).toBe('http://localhost:5173/share/abc123')
    expect(await screen.findByText('Link copiado.')).toBeInTheDocument()
  })

  it('revogar -- confirma no diálogo, volta para o estado "Compartilhar" e mostra o toast', async () => {
    server.use(
      http.post(`${API}/tickets/ticket-1/share`, () =>
        HttpResponse.json(
          { url: 'http://localhost:5173/share/abc123', expiresAt: new Date(Date.now() + 3600_000).toISOString() },
          { status: 201 },
        ),
      ),
      http.delete(`${API}/tickets/ticket-1/share`, () => new HttpResponse(null, { status: 204 })),
    )
    const user = userEvent.setup()
    renderButton()

    await user.click(screen.getByRole('button', { name: 'Compartilhar' }))
    await user.click(await screen.findByRole('button', { name: 'Revogar link' }))
    await user.click(await screen.findByRole('button', { name: 'Confirmar revogação' }))

    expect(await screen.findByText('Link revogado.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Compartilhar' })).toBeInTheDocument()
    expect(screen.queryByText('http://localhost:5173/share/abc123')).not.toBeInTheDocument()
  })

  it('erro ao gerar o link -- mensagem tratada por código, nunca um erro solto', async () => {
    server.use(
      http.post(`${API}/tickets/ticket-1/share`, () =>
        HttpResponse.json({ code: 'TICKET_CANCELLED', message: 'cancelado' }, { status: 409 }),
      ),
    )
    const user = userEvent.setup()
    renderButton()

    await user.click(screen.getByRole('button', { name: 'Compartilhar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ingresso cancelado não pode ser compartilhado.')
  })
})
