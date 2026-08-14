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

// A aplicação inteira, do zero -- mesma árvore de rotas de produção
// (`app/router.tsx`), mesmos providers de produção (`app/providers.tsx`), só
// trocando `createBrowserRouter` por `createMemoryRouter` (§ etapa 13: "renderizar
// a aplicação inteira sob um MemoryRouter"). Nenhum stub de auth aqui -- login de
// verdade contra os handlers de `test/msw/handlers/auth.ts`, exatamente o que prova
// que a passagem de contexto entre etapas (guard -> checkout -> ingresso -> portaria)
// funciona de ponta a ponta, não só cada tela isolada.

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
  // `findBy`, não `getBy` -- a segunda chamada (troca de sessão) acontece logo
  // depois de "Sair", cujo redirect para /entrar (`<Navigate>` do guard) leva um
  // ciclo de render a mais para de fato montar o formulário.
  await user.type(await screen.findByLabelText('E-mail'), email)
  await user.type(screen.getByLabelText('Senha'), TEST_PASSWORD)
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('fluxo ponta a ponta -- busca, reserva, pagamento aprovado, ingresso, validação (§ etapa 13)', () => {
  // O mais longo dos três (dois logins, duas confirmações com poll de 1s) --
  // 30s de teto cobre a suíte inteira rodando sob paralelismo pesado sem exigir
  // um valor artificialmente alto "só para garantir".
  it('do catálogo até a portaria liberar a entrada', { timeout: 30_000 }, async () => {
    const user = userEvent.setup()
    renderApp('/entrar')

    // login como cliente -- volta para o catálogo (sem ?redirect nesta entrada)
    await login(user, 'cliente@teste.dev')
    await user.click(await screen.findByRole('link', { name: /Duna: Parte Dois/ }))

    // detalhe do evento -- CTA de reserva
    await user.click(await screen.findByRole('link', { name: /Escolher assentos/ }))

    // mapa de assentos -- seleciona A1, reserva, segue para o checkout
    await user.click(await screen.findByLabelText('Assento A1, disponível'))
    await user.click(await screen.findByRole('button', { name: 'Reservar por 10 minutos' }))
    await user.click(await screen.findByRole('button', { name: 'Ir para pagamento' }))

    // checkout -- pedido criado automaticamente, "Aprovar pagamento" já é o default
    expect(await screen.findByText('Total: R$ 32,00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Pagar R\$\s?32,00/ }))

    // retorno -- pagamento aprovado; o cache da query ainda tem o pedido PENDING
    // de quando o formulário carregou (staleTime, `lib/query-client.ts`), então a
    // tela só reflete PAID depois do primeiro poll de 1s (`CheckoutReturnPage.tsx`)
    expect(
      await screen.findByRole('heading', { name: 'Pagamento aprovado' }, { timeout: 3000 }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Ver meus ingressos' }))

    // meus ingressos -- abre o ingresso recém-emitido, guarda o código de validação
    await user.click(await screen.findByRole('link', { name: /Duna: Parte Dois/ }))
    const codeElement = await screen.findByText(/^TKT1\./)
    const code = codeElement.textContent as string

    // troca de sessão: sai do cliente, entra como portaria
    await user.click(screen.getByRole('button', { name: 'Sair' }))
    await login(user, 'portaria@teste.dev')

    // nav por papel (Layout.tsx) só mostra "Portaria" para quem tem role GATE
    await user.click(await screen.findByRole('link', { name: 'Portaria' }))
    await user.click(await screen.findByLabelText('Sessão deste posto'))
    await user.click(await screen.findByRole('option', { name: /Duna: Parte Dois/ }))

    const input = await screen.findByLabelText('Código do ingresso')
    await user.type(input, `${code}{Enter}`)

    expect(await screen.findByRole('alert')).toHaveTextContent('Entrada liberada')
  })
})
