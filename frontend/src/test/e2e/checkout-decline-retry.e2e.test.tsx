import { configure } from '@testing-library/dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppProviders } from '../../app/providers'
import { routes } from '../../app/router'
import { TEST_PASSWORD } from '../msw/handlers/auth'

configure({ asyncUtilTimeout: 5000 })

vi.mock('../../lib/supabase', () => ({
  supabase: {
    channel: () => ({
      on: () => ({ subscribe: (statusCallback?: (status: string) => void) => statusCallback?.('SUBSCRIBED') }),
    }),
    removeChannel: vi.fn(),
  },
}))

function renderApp(initialPath: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] })
  return render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
}

describe('fluxo de recusa e nova tentativa (§ etapa 13)', () => {
  it('cartão recusado -- assento continua reservado, "Tentar outro cartão" paga sem escolher assento de novo', { timeout: 15_000 }, async () => {
    const user = userEvent.setup()
    renderApp('/entrar')

    await user.type(await screen.findByLabelText('E-mail'), 'cliente@teste.dev')
    await user.type(screen.getByLabelText('Senha'), TEST_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await user.click(await screen.findByRole('link', { name: /Duna: Parte Dois/ }))
    await user.click(await screen.findByRole('link', { name: /Escolher assentos/ }))
    await user.click(await screen.findByLabelText('Assento A1, disponível'))
    await user.click(await screen.findByRole('button', { name: 'Reservar por 10 minutos' }))
    await user.click(await screen.findByRole('button', { name: 'Ir para pagamento' }))

    expect(await screen.findByText('Total: R$ 32,00')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Resultado do pagamento (simulação)'))
    await user.click(await screen.findByRole('option', { name: 'Recusar pagamento' }))
    await user.click(screen.getByRole('button', { name: /Pagar R\$\s?32,00/ }))

    expect(
      await screen.findByRole('heading', { name: 'Pagamento recusado' }, { timeout: 3000 }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tentar outro cartão' }))

    expect(await screen.findByText('Total: R$ 32,00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Pagar R\$\s?32,00/ }))

    expect(
      await screen.findByRole('heading', { name: 'Pagamento aprovado' }, { timeout: 3000 }),
    ).toBeInTheDocument()
  })
})
