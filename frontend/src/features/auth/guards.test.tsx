import { screen } from '@testing-library/react'
import { Route, Routes, useSearchParams } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { makeAuth, renderWithProviders } from '../../test/render'
import { RequireAuth, RequireRole } from './guards'
import type { AuthContextValue } from './useAuth'

function LoginStub() {
  const [params] = useSearchParams()
  return <div>Tela de login (redirect={params.get('redirect')})</div>
}

function renderWithAuth(authValue: AuthContextValue, initialPath: string) {
  return renderWithProviders(
    <Routes>
      <Route element={<RequireAuth />}>
        <Route path="/protegida" element={<div>Conteúdo protegido</div>} />
        <Route element={<RequireRole role="ORGANIZER" />}>
          <Route path="/organizador" element={<div>Painel</div>} />
        </Route>
      </Route>
      <Route path="/entrar" element={<LoginStub />} />
    </Routes>,
    { initialEntries: [initialPath], auth: authValue },
  )
}

describe('RequireAuth', () => {
  it('loading não redireciona -- mostra a tela de verificação de sessão', () => {
    renderWithAuth(makeAuth({ status: 'loading' }), '/protegida')

    // `getByRole('status')` sozinho bateria também no viewport do Toast (sempre
    // presente via `renderWithProviders`) -- `role="status"` não computa nome a
    // partir do conteúdo (não está na lista de roles "name from content" do
    // accname), então filtrar por `name` não desempata; o texto do Spinner
    // (`sr-only`) desempata sem ambiguidade.
    expect(screen.getByText('Verificando sessão')).toBeInTheDocument()
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
