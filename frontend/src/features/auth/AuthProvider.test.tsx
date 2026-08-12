import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { env } from '../../lib/env'
import { queryClient } from '../../lib/query-client'
import { server } from '../../test/msw/server'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

const API = env.VITE_API_URL

function Probe() {
  const { user, status, logout } = useAuth()
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{user?.email ?? ''}</span>
      <button type="button" onClick={() => void logout()}>
        Sair
      </button>
    </div>
  )
}

function renderWithProviders() {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  queryClient.clear()
})

describe('AuthProvider', () => {
  it('refresh no boot restaura a sessão (accessToken + GET /auth/me)', async () => {
    server.use(
      http.post(`${API}/auth/refresh`, () => HttpResponse.json({ accessToken: 'token-1' })),
      http.get(`${API}/auth/me`, () =>
        HttpResponse.json({ id: 'u1', name: 'Ana', email: 'ana@exemplo.com', role: 'CUSTOMER' }),
      ),
    )

    renderWithProviders()

    expect(screen.getByTestId('status')).toHaveTextContent('loading')

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    expect(screen.getByTestId('user')).toHaveTextContent('ana@exemplo.com')
  })

  it('refresh sem sessão -- cai em anonymous, sem erro visível na tela', async () => {
    server.use(
      http.post(`${API}/auth/refresh`, () =>
        HttpResponse.json({ code: 'UNAUTHORIZED', message: 'Sessão ausente' }, { status: 401 }),
      ),
    )

    renderWithProviders()

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('logout revoga no servidor e limpa o cache do Query', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(`${API}/auth/refresh`, () => HttpResponse.json({ accessToken: 'token-1' })),
      http.get(`${API}/auth/me`, () =>
        HttpResponse.json({ id: 'u1', name: 'Ana', email: 'ana@exemplo.com', role: 'CUSTOMER' }),
      ),
      http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
    )

    queryClient.setQueryData(['sentinela-do-usuario-anterior'], 'ainda-em-cache')

    renderWithProviders()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))

    await user.click(screen.getByRole('button', { name: 'Sair' }))

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'))
    expect(screen.getByTestId('user')).toHaveTextContent('')
    expect(queryClient.getQueryData(['sentinela-do-usuario-anterior'])).toBeUndefined()
  })
})
