import type { ReactElement, ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderResult } from '@testing-library/react'
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom'
import { vi } from 'vitest'
import { ToastProvider } from '../components'
import { queryClient } from '../lib/query-client'
import { AuthContext, type AuthContextValue } from '../features/auth/useAuth'

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

export function renderWithProviders(ui: ReactElement, options: RenderWithProvidersOptions = {}): RenderResult {
  queryClient.clear()

  return render(
    <TestProviders auth={options.auth} initialEntries={options.initialEntries}>
      {ui}
    </TestProviders>,
  )
}
