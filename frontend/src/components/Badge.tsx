import type { ReactNode } from 'react'
import styles from './Badge.module.css'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
}

// Badge de gênero usa --primary-tint como fundo (§5.1.1) -- segue sendo o default.
// Variantes semânticas (etapa 09, status de ingresso: Ativo/Usado/Cancelado) usam
// --success/--warning/--danger sobre o mesmo tom de fundo tintado (color-mix, mesmo
// padrão já usado em `.formError` de outras telas) -- nunca cor sozinha: o texto do
// badge sempre diz o status por extenso, cor é reforço, não único sinal (WCAG 1.4.1).
export function Badge({ children, variant = 'default' }: BadgeProps) {
  const classes = [styles.badge, variant !== 'default' && styles[variant]].filter(Boolean).join(' ')
  return <span className={classes}>{children}</span>
}
