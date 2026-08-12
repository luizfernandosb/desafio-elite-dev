import { Button } from './Button'
import styles from './Pagination.module.css'

interface PaginationProps {
  page: number
  totalPages: number
  hasPrev: boolean
  hasNext: boolean
  onPageChange: (page: number) => void
}

// Só anterior/próxima -- o contrato `{ data, meta }` (§5.6.2) já resolve `hasNext`/
// `hasPrev` no servidor; nenhuma tela recalcula isso a partir de `total`/`limit`.
export function Pagination({ page, totalPages, hasPrev, hasNext, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <nav className={styles.nav} aria-label="Paginação">
      <Button variant="secondary" disabled={!hasPrev} onClick={() => onPageChange(page - 1)}>
        Anterior
      </Button>
      <span className={styles.status} aria-live="polite">
        Página {page} de {totalPages}
      </span>
      <Button variant="secondary" disabled={!hasNext} onClick={() => onPageChange(page + 1)}>
        Próxima
      </Button>
    </nav>
  )
}
