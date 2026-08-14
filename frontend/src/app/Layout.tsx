import type { ReactNode } from 'react'
import { Film, LayoutDashboard, LogIn, LogOut, ShieldCheck, Ticket } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { ThemeToggle } from '../components/ThemeToggle'
import { useAuth } from '../features/auth/useAuth'
import { Footer } from './Footer'
import styles from './Layout.module.css'

interface SidebarLinkProps {
  to: string
  icon: ReactNode
  children: ReactNode
  // só o Catálogo ("/") precisa disto -- sem `end`, `/` fica "ativo" em qualquer
  // rota (prefixo de tudo); os demais links não têm esse problema (não são prefixo
  // de outra rota).
  end?: boolean
}

function SidebarLink({ to, icon, children, end }: SidebarLinkProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => [styles.navLink, isActive ? styles.navLinkActive : null].filter(Boolean).join(' ')}
    >
      <span aria-hidden="true">{icon}</span>
      {children}
    </NavLink>
  )
}

// Navegação por papel (§ etapa 03): cliente vê "Meus ingressos", organizador vê
// "Painel", portaria vê só "Portaria" -- o operador não navega no catálogo durante
// o evento. `status === 'loading'` não mostra nenhum link de sessão (nem "Entrar"
// nem "Sair") para não piscar um estado incorreto enquanto o boot do AuthProvider
// ainda não respondeu.
function RoleLink() {
  const { user, status } = useAuth()
  if (status !== 'authenticated' || !user) return null

  if (user.role === 'GATE') {
    return (
      <SidebarLink to="/portaria" icon={<ShieldCheck size={18} />}>
        Portaria
      </SidebarLink>
    )
  }
  if (user.role === 'ORGANIZER') {
    return (
      <SidebarLink to="/organizador" icon={<LayoutDashboard size={18} />}>
        Painel
      </SidebarLink>
    )
  }
  return (
    <SidebarLink to="/ingressos" icon={<Ticket size={18} />}>
      Meus ingressos
    </SidebarLink>
  )
}

function SessionAction() {
  const { status, logout } = useAuth()
  if (status === 'loading') return null
  if (status === 'anonymous') {
    return (
      <SidebarLink to="/entrar" icon={<LogIn size={18} />}>
        Entrar
      </SidebarLink>
    )
  }
  return (
    <button type="button" className={styles.navLink} onClick={() => void logout()}>
      <span aria-hidden="true">
        <LogOut size={18} />
      </span>
      Sair
    </button>
  )
}

export function Layout() {
  return (
    <div className={styles.shell}>
      <a href="#conteudo" className="skip-link">
        Ir para o conteúdo
      </a>

      <aside className={styles.sidebar}>
        <Link to="/" className={styles.logo}>
          TicketDev
        </Link>
        <nav className={styles.nav} aria-label="Principal">
          <SidebarLink to="/" icon={<Film size={18} />} end>
            Catálogo
          </SidebarLink>
          <RoleLink />
        </nav>
        <div className={styles.session}>
          <ThemeToggle />
          <SessionAction />
        </div>
      </aside>

      <div className={styles.column}>
        <main id="conteudo" className={styles.main}>
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  )
}
