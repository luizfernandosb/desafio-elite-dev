import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api'
import { AuthContext, type AuthContextValue } from '../useAuth'
import { LoginPage } from './LoginPage'

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

function renderLoginPage(authValue: AuthContextValue) {
  return render(
    <MemoryRouter initialEntries={['/entrar']}>
      <AuthContext.Provider value={authValue}>
        <LoginPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  it('e-mail inválido bloqueia o envio -- login nunca é chamado', async () => {
    const login = vi.fn()
    const user = userEvent.setup()
    renderLoginPage(makeAuth({ login }))

    await user.type(screen.getByLabelText('E-mail'), 'nao-e-email')
    await user.tab() // onBlur -- validação não é a cada tecla (§ etapa 03)
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('E-mail inválido')).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })

  it('credenciais inválidas -- mensagem única, não distingue e-mail de senha errados', async () => {
    const login = vi.fn().mockRejectedValue(new ApiError('UNAUTHORIZED', 'Credenciais inválidas', 401))
    const user = userEvent.setup()
    renderLoginPage(makeAuth({ login }))

    await user.type(screen.getByLabelText('E-mail'), 'gente@exemplo.com')
    await user.type(screen.getByLabelText('Senha'), 'senha-errada')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.')
  })

  it('botão em loading bloqueia clique repetido -- login chamado só uma vez', async () => {
    let resolveLogin = () => {}
    const login = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveLogin = resolve
        }),
    )
    const user = userEvent.setup()
    renderLoginPage(makeAuth({ login }))

    await user.type(screen.getByLabelText('E-mail'), 'gente@exemplo.com')
    await user.type(screen.getByLabelText('Senha'), 'senha-qualquer')

    const button = screen.getByRole('button', { name: 'Entrar' })
    await user.click(button)
    await user.click(button) // segundo clique enquanto a primeira chamada ainda está pendente

    expect(login).toHaveBeenCalledTimes(1)
    resolveLogin()
  })
})
