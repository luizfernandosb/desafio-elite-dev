import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api'

// retry: false para 4xx -- repetir um 403 não muda nada e só atrasa a mensagem de
// erro na tela. 5xx/rede continuam com 1 retry (falha transitória vale tentar de novo).
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
  return true
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: shouldRetry,
      // catálogo e mapa de assentos envelhecem rápido (outro cliente pode ter
      // reservado); o resto (perfil, meus ingressos) não precisa reconferir a cada
      // troca de aba -- ligado por query só onde faz sentido (etapa 05/06), não aqui.
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false, // mutação repetida por conta própria é o tipo de bug que duplica pedido
    },
  },
})
