import type { ReactElement, ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderResult } from '@testing-library/react'
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom'
import { vi } from 'vitest'
import { ToastProvider } from '../components'
import { queryClient } from '../lib/query-client'
import { AuthContext, type AuthContextValue } from '../features/auth/useAuth'

// Sessão anônima por padrão -- a maioria das telas testadas não depende de um
// papel específico; quem precisa de outro estado passa `auth` (parcial, cobre só
// o que o teste de fato usa, igual ao `makeAuth` que cada arquivo reimplementava).
const anonymousAuth: AuthContextValue = {
  user: null,
  status: 'anonymous',
  login: vi.fn(),
  register: vi.fn(),
  loginWithGoogle: vi.fn(),
  logout: vi.fn(),
}

export function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return { ...anonymousAuth, ...overrides }
}

interface TestProvidersProps {
  children: ReactNode
  auth?: Partial<AuthContextValue>
  initialEntries?: MemoryRouterProps['initialEntries']
}

// QueryClient real (mesmo `staleTime`/`retry` de produção, `lib/query-client.ts`,
// nunca um `QueryClient` novo com defaults próprios: é exatamente essa
// divergência silenciosa entre teste e produção que este componente existe para
// eliminar), sessão de auth (stub, anônima por padrão) e Toast -- usado tanto por
// `renderWithProviders` (component tests) quanto como `wrapper` de `renderHook`
// (testes de hook, que não passam por `render`).
//
// AuthProvider real por baixo continua funcionando normalmente: React usa o
// provider de contexto MAIS PRÓXIMO, então envolver `<AuthProvider>...` com isto
// faz o valor real do AuthProvider sobrepor este stub para os descendentes, sem
// precisar de um modo especial aqui.
export function TestProviders({ children, auth, initialEntries }: TestProvidersProps) {
  const authValue = makeAuth(auth)

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <ToastProvider>
          <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
        </ToastProvider>
      </AuthContext.Provider>
    </QueryClientProvider>
  )
}

interface RenderWithProvidersOptions {
  initialEntries?: MemoryRouterProps['initialEntries']
  auth?: Partial<AuthContextValue>
}

// Centraliza os providers de teste (§ etapa 13) -- nenhum teste de componente
// monta `QueryClientProvider` à mão. Router é sempre um `MemoryRouter` -- quem
// precisa de mais de uma rota (navegação, `useParams`, redirect) passa `<Routes>`
// como `ui`, em vez deste helper crescer uma API paralela de configuração de rotas.
export function renderWithProviders(ui: ReactElement, options: RenderWithProvidersOptions = {}): RenderResult {
  queryClient.clear()

  return render(
    <TestProviders auth={options.auth} initialEntries={options.initialEntries}>
      {ui}
    </TestProviders>,
  )
}
