import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ForbiddenPage } from '../../app/routes/ForbiddenPage'
import { Spinner } from '../../components/Spinner'
import type { Role } from './api'
import { useAuth } from './useAuth'
import styles from './guards.module.css'

function SessionChecking() {
  return (
    <div className={styles.checking}>
      <Spinner size="lg" label="Verificando sessão" />
    </div>
  )
}

export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <SessionChecking />

  if (status === 'anonymous') {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/entrar?redirect=${redirect}`} replace />
  }

  return <Outlet />
}

interface RequireRoleProps {
  role: Role
}

export function RequireRole({ role }: RequireRoleProps) {
  const { user, status } = useAuth()

  if (status === 'loading') return <SessionChecking />
  if (!user || user.role !== role) return <ForbiddenPage />

  return <Outlet />
}
