import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../components/Toast'
import { AuthProvider } from '../features/auth/AuthProvider'
import { queryClient } from '../lib/query-client'
import { ErrorBoundary } from './ErrorBoundary'

interface Props {
  children: ReactNode
}

// Theme não precisa de provider -- é `data-theme` no <html>, ver lib/theme.ts. A
// reação a sessão expirada (onSessionExpired -> limpar estado -> navegar para
// /entrar) mora dentro do AuthProvider (etapa 03), não aqui: é o dono do domínio de
// auth, e precisa do queryClient (via useQueryClient) para limpar o cache no mesmo
// gesto -- por isso AuthProvider fica DENTRO do QueryClientProvider.
export function AppProviders({ children }: Props) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
