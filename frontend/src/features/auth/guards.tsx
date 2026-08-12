import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ForbiddenPage } from '../../app/routes/ForbiddenPage'
import { Spinner } from '../../components/Spinner'
import type { Role } from './api'
import { useAuth } from './useAuth'
import styles from './guards.module.css'

// Guard é experiência, não segurança -- a autorização real está no back-end (RBAC +
// RLS, §7.9). Quem chama a API direto, ou desabilita o JS, não passa por aqui; o
// guard só evita que a UI normal mostre uma tela quebrada para o papel errado.
function SessionChecking() {
  // sem role="status" no wrapper -- o Spinner já anuncia via o próprio (label
  // "Verificando sessão"); duplicar o role só criaria dois landmarks para o mesmo anúncio
  return (
    <div className={styles.checking}>
      <Spinner size="lg" label="Verificando sessão" />
    </div>
  )
}

export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  // loading NUNCA redireciona -- redirecionar aqui desloga quem só recarregou a
  // página (F5) antes do POST /auth/refresh do boot responder (§ critério de aceite)
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

// Sempre aninhado dentro de <RequireAuth /> na árvore de rotas (ver router.tsx) --
// por isso só precisa checar o papel, não a autenticação de novo. Os casos
// loading/sem-usuário abaixo são defensivos (não deveriam disparar na composição
// correta), nunca uma segunda cópia da lógica de RequireAuth.
export function RequireRole({ role }: RequireRoleProps) {
  const { user, status } = useAuth()

  if (status === 'loading') return <SessionChecking />
  if (!user || user.role !== role) return <ForbiddenPage />

  return <Outlet />
}
