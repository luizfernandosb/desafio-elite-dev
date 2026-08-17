import { Link } from 'react-router-dom'
import styles from './Footer.module.css'

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
