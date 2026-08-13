import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { makeAuth, renderWithProviders } from '../../../test/render'
import type { AuthContextValue } from '../useAuth'
import { RegisterPage } from './RegisterPage'

function renderRegisterPage(authValue: AuthContextValue) {
  return renderWithProviders(<RegisterPage />, { initialEntries: ['/cadastrar'], auth: authValue })
}

describe('RegisterPage', () => {
  it('senha com 9 caracteres é rejeitada -- register nunca é chamado', async () => {
    const registerFn = vi.fn()
    const user = userEvent.setup()
    renderRegisterPage(makeAuth({ register: registerFn }))

    await user.type(screen.getByLabelText('Nome'), 'Ana')
    await user.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com')
    await user.type(screen.getByLabelText('Senha'), '123456789')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(await screen.findByText('Senha deve ter ao menos 10 caracteres')).toBeInTheDocument()
    expect(registerFn).not.toHaveBeenCalled()
  })

  it('e-mail com domínio composto (a@b.com.br) é aceito', async () => {
    const registerFn = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderRegisterPage(makeAuth({ register: registerFn }))

    await user.type(screen.getByLabelText('Nome'), 'Ana')
    await user.type(screen.getByLabelText('E-mail'), 'ana@empresa.com.br')
    await user.type(screen.getByLabelText('Senha'), 'senha-com-10-chars')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))

    await waitFor(() =>
      expect(registerFn).toHaveBeenCalledWith('Ana', 'ana@empresa.com.br', 'senha-com-10-chars'),
    )
  })

  it('sem seletor de papel no formulário -- só nome, e-mail e senha', () => {
    renderRegisterPage(makeAuth())

    expect(screen.queryByLabelText(/papel|função|role/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/esqueci minha senha/i)).not.toBeInTheDocument()
  })
})
