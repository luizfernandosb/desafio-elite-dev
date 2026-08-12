import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { router } from '../../app/router'
import { onSessionExpired, setAccessToken } from '../../lib/api'
import { googleLoginRequest, loginRequest, logoutRequest, meRequest, refreshRequest, registerRequest } from './api'
import type { PublicUser } from './api'
import { AuthContext, type AuthContextValue, type AuthStatus } from './useAuth'

interface Props {
  children: ReactNode
}

// Decisão central (§ etapa 03): access token só em memória (aqui e em lib/api.ts),
// nunca em localStorage/sessionStorage -- o refresh mora num cookie httpOnly que o
// back já entrega (§7.2). Custo assumido: um POST /auth/refresh no boot para
// recuperar a sessão; `status === 'loading'` existe exatamente para cobrir essa
// espera sem piscar a tela de login (o defeito mais comum desta abordagem).
export function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<PublicUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const queryClient = useQueryClient()

  const clearSession = useCallback(() => {
    setAccessToken(null)
    setUser(null)
    setStatus('anonymous')
    // sem isto, o próximo usuário na mesma aba veria o cache do anterior (§ critério
    // de aceite: voltar no histórico não pode mostrar ingressos de outra pessoa)
    queryClient.clear()
  }, [queryClient])

  // Dois 401 seguidos em qualquer requisição (fila de refresh de lib/api.ts já
  // tentou renovar e falhou) -- sessão de fato acabou, não só um token momentaneamente
  // velho. `router.navigate` funciona fora da árvore do RouterProvider (é método do
  // objeto router, não hook) -- mesmo raciocínio de app/providers.tsx na etapa 01.
  useEffect(() => {
    return onSessionExpired(() => {
      clearSession()
      router.navigate('/entrar')
    })
  }, [clearSession])

  useEffect(() => {
    let active = true

    async function restoreSession() {
      try {
        const { accessToken } = await refreshRequest()
        setAccessToken(accessToken)
        const me = await meRequest()
        if (!active) return
        setUser(me)
        setStatus('authenticated')
      } catch {
        // não estar logado não é erro -- silencioso, sem tela de erro (§ etapa 03)
        if (!active) return
        setAccessToken(null)
        setStatus('anonymous')
      }
    }

    void restoreSession()
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const session = await loginRequest({ email, password })
    setAccessToken(session.accessToken)
    setUser(session.user)
    setStatus('authenticated')
  }, [])

  const register = useCallback(async (name: string, email: string, password: string) => {
    const session = await registerRequest({ name, email, password })
    setAccessToken(session.accessToken)
    setUser(session.user)
    setStatus('authenticated')
  }, [])

  const loginWithGoogle = useCallback(async (credential: string) => {
    const session = await googleLoginRequest(credential)
    setAccessToken(session.accessToken)
    setUser(session.user)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(async () => {
    try {
      // revoga no servidor ANTES de limpar local (§ etapa 03)
      await logoutRequest()
    } finally {
      // ...mas limpa local mesmo se a chamada falhar -- uma falha de rede no logout
      // não pode deixar o usuário "logado" localmente para sempre
      clearSession()
    }
  }, [clearSession])

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, register, loginWithGoogle, logout }),
    [user, status, login, register, loginWithGoogle, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
