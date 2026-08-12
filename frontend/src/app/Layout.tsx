import { Link, Outlet } from 'react-router-dom'

// Sem tokens/componentes de design system ainda (etapa 02) e sem navegação por papel
// de verdade ainda (depende de sessão, etapa 03) -- só a casca: skip link, header e
// `<main id="conteudo">`, que é o alvo do skip link e a fronteira de erro por rota
// (ver ErrorBoundary.tsx e router.tsx).
export function Layout() {
  return (
    <>
      <a href="#conteudo" className="skip-link">
        Ir para o conteúdo
      </a>
      <header>
        <nav aria-label="Principal">
          <Link to="/">TicketDev</Link>
        </nav>
      </header>
      <main id="conteudo">
        <Outlet />
      </main>
    </>
  )
}
