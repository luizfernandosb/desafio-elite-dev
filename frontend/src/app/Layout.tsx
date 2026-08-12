import { Link, Outlet } from 'react-router-dom'
import { Button } from '../components/Button'
import { ThemeToggle } from '../components/ThemeToggle'
import { useAuth } from '../features/auth/useAuth'
import styles from './Layout.module.css'

// Navegação por papel (§ etapa 03): cliente vê "Meus ingressos", organizador vê
// "Painel", portaria vê só "Portaria" -- o operador não navega no catálogo durante
// o evento. `status === 'loading'` não mostra nenhum link de sessão (nem "Entrar"
// nem "Sair") para não piscar um estado incorreto enquanto o boot do AuthProvider
// ainda não respondeu.
function RoleLink() {
  const { user, status } = useAuth()
  if (status !== 'authenticated' || !user) return null

  if (user.role === 'GATE') return <Link to="/portaria">Portaria</Link>
  if (user.role === 'ORGANIZER') return <Link to="/organizador">Painel</Link>
  return <Link to="/ingressos">Meus ingressos</Link>
}

function SessionAction() {
  const { status, logout } = useAuth()
  if (status === 'loading') return null
  if (status === 'anonymous') return <Link to="/entrar">Entrar</Link>
  return (
    <Button variant="ghost" onClick={() => void logout()}>
      Sair
    </Button>
  )
}

export function Layout() {
  return (
    <>
      <a href="#conteudo" className="skip-link">
        Ir para o conteúdo
      </a>
      <header className={styles.header}>
        <nav className={styles.nav} aria-label="Principal">
          <Link to="/" className={styles.logo}>
            TicketDev
          </Link>
          <RoleLink />
        </nav>
        <div className={styles.actions}>
          <ThemeToggle />
          <SessionAction />
        </div>
      </header>
      <main id="conteudo">
        <Outlet />
      </main>
    </>
  )
}
