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

vi.mock('@zxing/browser', () => ({
  BrowserQRCodeReader: vi.fn().mockImplementation(function FakeBrowserQRCodeReader() {
    return { decodeFromConstraints: vi.fn().mockRejectedValue(new Error('sem câmera em jsdom')) }
  }),
}))

function renderApp(initialPath: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] })
  return render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
}

async function login(user: ReturnType<typeof userEvent.setup>, email: string) {
  await user.type(await screen.findByLabelText('E-mail'), email)
  await user.type(screen.getByLabelText('Senha'), TEST_PASSWORD)
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('fluxo ponta a ponta -- busca, reserva, pagamento aprovado, ingresso, validação (§ etapa 13)', () => {
  it('do catálogo até a portaria liberar a entrada', { timeout: 30_000 }, async () => {
    const user = userEvent.setup()
    renderApp('/entrar')

    await login(user, 'cliente@teste.dev')
    await user.click(await screen.findByRole('link', { name: /Duna: Parte Dois/ }))

    await user.click(await screen.findByRole('link', { name: /Escolher assentos/ }))

    await user.click(await screen.findByLabelText('Assento A1, disponível'))
    await user.click(await screen.findByRole('button', { name: 'Reservar por 10 minutos' }))
    await user.click(await screen.findByRole('button', { name: 'Ir para pagamento' }))

    expect(await screen.findByText('Total: R$ 32,00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Pagar R\$\s?32,00/ }))

    expect(
      await screen.findByRole('heading', { name: 'Pagamento aprovado' }, { timeout: 3000 }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Ver meus ingressos' }))

    await user.click(await screen.findByRole('link', { name: /Duna: Parte Dois/ }))
    const codeElement = await screen.findByText(/^TKT1\./)
    const code = codeElement.textContent as string

    await user.click(screen.getByRole('button', { name: 'Sair' }))
    await login(user, 'portaria@teste.dev')

    await user.click(await screen.findByRole('link', { name: 'Portaria' }))
    await user.click(await screen.findByLabelText('Sessão deste posto'))
    await user.click(await screen.findByRole('option', { name: /Duna: Parte Dois/ }))

    const input = await screen.findByLabelText('Código do ingresso')
    await user.type(input, `${code}{Enter}`)

    expect(await screen.findByRole('alert')).toHaveTextContent('Entrada liberada')
  })
})
