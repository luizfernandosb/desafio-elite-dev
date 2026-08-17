import type { ReactNode } from 'react'
import styles from './Badge.module.css'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  const classes = [styles.badge, variant !== 'default' && styles[variant]].filter(Boolean).join(' ')
  return <span className={classes}>{children}</span>
}
