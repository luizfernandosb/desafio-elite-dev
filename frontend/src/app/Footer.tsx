import { Link } from 'react-router-dom'
import styles from './Footer.module.css'

// Deliberadamente mínimo -- sem redes sociais, sem badge de app store, sem colunas
// de links institucionais: nenhuma dessas páginas existe neste produto, e um footer
// com links mortos é pior do que nenhum footer.
export function Footer() {
  return (
    <footer className={styles.footer}>
      <Link to="/" className={styles.logo}>
        TicketDev
      </Link>
      <p className={styles.tagline}>Compre ingressos de cinema em poucos cliques.</p>
      <p className={styles.copyright}>© {new Date().getFullYear()} TicketDev. Todos os direitos reservados.</p>
    </footer>
  )
}
