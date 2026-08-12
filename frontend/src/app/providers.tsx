import { useEffect, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../components/Toast'
import { onSessionExpired } from '../lib/api'
import { queryClient } from '../lib/query-client'
import { ErrorBoundary } from './ErrorBoundary'
import { router } from './router'

interface Props {
  children: ReactNode
}

// Auth entra aqui na etapa 03 -- por ora TanStack Query, o error boundary de raiz e
// o Toast (etapa 02; Theme não precisa de provider, é `data-theme` no <html>, ver
// lib/theme.ts). `router.navigate` é um método do próprio objeto `router` (singleton
// criado em router.tsx), não um hook -- por isso funciona chamado de fora da árvore
// do RouterProvider, sem precisar de `useNavigate()` aqui.
export function AppProviders({ children }: Props) {
  useEffect(() => onSessionExpired(() => router.navigate('/entrar')), [])

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
