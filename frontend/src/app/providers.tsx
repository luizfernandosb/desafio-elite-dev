import { useEffect, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { onSessionExpired } from '../lib/api'
import { queryClient } from '../lib/query-client'
import { ErrorBoundary } from './ErrorBoundary'
import { router } from './router'

interface Props {
  children: ReactNode
}

// Auth, Theme e Toast entram aqui conforme as etapas 02/03 nascem -- por ora só o
// que já tem dono: TanStack Query e o error boundary de raiz. `router.navigate` é um
// método do próprio objeto `router` (singleton criado em router.tsx), não um hook --
// por isso funciona chamado de fora da árvore do RouterProvider, sem precisar de
// `useNavigate()` aqui.
export function AppProviders({ children }: Props) {
  useEffect(() => onSessionExpired(() => router.navigate('/entrar')), [])

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ErrorBoundary>
  )
}
