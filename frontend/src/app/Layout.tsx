import { Link, Outlet } from 'react-router-dom'
import { ThemeToggle } from '../components/ThemeToggle'
import styles from './Layout.module.css'

// Sem navegação por papel de verdade ainda (depende de sessão, etapa 03) -- header
// com logo, alternador de tema (etapa 02) e `<main id="conteudo">`, alvo do skip
// link e fronteira de erro por rota (ver ErrorBoundary.tsx e router.tsx).
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
        </nav>
        <div className={styles.themeToggle}>
          <ThemeToggle />
        </div>
      </header>
      <main id="conteudo">
        <Outlet />
      </main>
    </>
  )
}
