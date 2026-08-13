import { configure } from '@testing-library/dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppProviders } from '../../app/providers'
import { routes } from '../../app/router'
import { TEST_PASSWORD } from '../msw/handlers/auth'

// Suíte inteira sob carga (paralelismo do Vitest, § etapa 13) pode deixar um
// `findBy*` isolado mais lento do que rodar este arquivo sozinho -- o teste
// continua correto, só precisa de mais fôlego que o default de 1s da Testing
// Library antes de desistir.
configure({ asyncUtilTimeout: 5000 })

// Guard + redirect + retorno (§ etapa 13): visitante anônimo clica em "Escolher
// assentos" ([05](05-catalogo-publico.md)), cai na tela de login
// ([03](03-autenticacao.md)) e, depois de logar, volta exatamente para o mapa do
// evento clicado -- nunca para a home. Isto só é visível com as rotas reais
// (`RequireAuth`, `app/router.tsx`) e o `LoginPage` de verdade lendo `?redirect=`
// juntos; nenhum teste isolado de um dos dois prova a integração dos dois.

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
    await user.click(await screen.findByRole('link', { name: 'Escolher assentos' }))

    // guard -- ainda anônimo, cai no login preservando o destino em ?redirect=
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('E-mail'), 'cliente@teste.dev')
    await user.type(screen.getByLabelText('Senha'), TEST_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    // volta para o MAPA DE ASSENTOS do evento clicado -- nunca para o catálogo (a
    // home só mostraria os cards de novo, sem indicar que o guard lembrou de nada)
    expect(await screen.findByRole('grid', { name: /Mapa de assentos/ })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Catálogo' })).not.toBeInTheDocument()
  })
})
