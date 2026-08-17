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

export function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<PublicUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const queryClient = useQueryClient()

  const clearSession = useCallback(() => {
    setAccessToken(null)
    setUser(null)
    setStatus('anonymous')
    queryClient.clear()
  }, [queryClient])

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
      await logoutRequest()
    } finally {
      clearSession()
      router.navigate('/')
    }
  }, [clearSession])

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, register, loginWithGoogle, logout }),
    [user, status, login, register, loginWithGoogle, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
