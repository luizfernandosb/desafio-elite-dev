import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { OfflineBanner } from '../components/OfflineBanner'
import { ToastProvider } from '../components/Toast'
import { AuthProvider } from '../features/auth/AuthProvider'
import { queryClient } from '../lib/query-client'
import { ErrorBoundary } from './ErrorBoundary'

interface Props {
  children: ReactNode
}

export function AppProviders({ children }: Props) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <OfflineBanner />
            {children}
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
