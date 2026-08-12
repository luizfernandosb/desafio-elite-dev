import type { ReactNode } from 'react'
import styles from './Badge.module.css'

interface BadgeProps {
  children: ReactNode
}

// Badge de gênero usa --primary-tint como fundo (§5.1.1) -- é o único uso previsto
// nesta etapa. Variantes semânticas (sucesso/erro/etc.) não existem ainda: a
// portaria (etapa 10) tem paleta própria, documentada como exceção ao grep de hex.
export function Badge({ children }: BadgeProps) {
  return <span className={styles.badge}>{children}</span>
}
