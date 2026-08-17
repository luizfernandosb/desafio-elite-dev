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

describe('guard + redirect + retorno (§ etapa 13)', () => {
  it('anônimo -> escolher assentos -> login -> volta para o mapa do MESMO evento, não para a home', { timeout: 15_000 }, async () => {
    const user = userEvent.setup()
    renderApp('/')

    await user.click(await screen.findByRole('link', { name: /Duna: Parte Dois/ }))
    await user.click(await screen.findByRole('link', { name: /Escolher assentos/ }))

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('E-mail'), 'cliente@teste.dev')
    await user.type(screen.getByLabelText('Senha'), TEST_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('grid', { name: /Mapa de assentos/ })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Catálogo' })).not.toBeInTheDocument()
  })
})
