import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useSearchParams, type RouteObject } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { RequireAuth, RequireRole } from './guards'
import { AuthContext, type AuthContextValue } from './useAuth'

function LoginStub() {
  const [params] = useSearchParams()
  return <div>Tela de login (redirect={params.get('redirect')})</div>
}

const PROTECTED_ROUTES: RouteObject[] = [
  {
    element: <RequireAuth />,
    children: [
      { path: '/protegida', element: <div>Conteúdo protegido</div> },
      {
        element: <RequireRole role="ORGANIZER" />,
        children: [{ path: '/organizador', element: <div>Painel</div> }],
      },
    ],
  },
  { path: '/entrar', element: <LoginStub /> },
]

function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    status: 'anonymous',
    login: vi.fn(),
    register: vi.fn(),
    loginWithGoogle: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  }
}

function renderWithAuth(authValue: AuthContextValue, initialPath: string) {
  const router = createMemoryRouter(PROTECTED_ROUTES, { initialEntries: [initialPath] })
  return render(
    <AuthContext.Provider value={authValue}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )
}

describe('RequireAuth', () => {
  it('loading não redireciona -- mostra a tela de verificação de sessão', () => {
    renderWithAuth(makeAuth({ status: 'loading' }), '/protegida')

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText(/tela de login/)).not.toBeInTheDocument()
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
  })

  it('anonymous redireciona para /entrar preservando o destino em ?redirect=', () => {
    renderWithAuth(makeAuth({ status: 'anonymous' }), '/protegida')

    expect(screen.getByText('Tela de login (redirect=/protegida)')).toBeInTheDocument()
  })

  it('authenticated renderiza a rota protegida', () => {
    renderWithAuth(
      makeAuth({ status: 'authenticated', user: { id: '1', name: 'A', email: 'a@a.com', role: 'CUSTOMER' } }),
      '/protegida',
    )

    expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument()
  })
})

describe('RequireRole', () => {
  it('papel errado -- página 403 própria, não redireciona em silêncio', () => {
    renderWithAuth(
      makeAuth({ status: 'authenticated', user: { id: '1', name: 'A', email: 'a@a.com', role: 'CUSTOMER' } }),
      '/organizador',
    )

    expect(screen.getByRole('heading', { name: /acesso não permitido/i })).toBeInTheDocument()
  })

  it('papel certo -- renderiza a rota', () => {
    renderWithAuth(
      makeAuth({ status: 'authenticated', user: { id: '1', name: 'A', email: 'a@a.com', role: 'ORGANIZER' } }),
      '/organizador',
    )

    expect(screen.getByText('Painel')).toBeInTheDocument()
  })
})
