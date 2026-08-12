import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Spinner } from './Spinner'
import styles from './Button.module.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  loading?: boolean
  children: ReactNode
}

// CTA primário exatamente §5.1.1: background var(--primary), texto branco, sem
// sombra, sem gradiente. Hover var(--primary-hover), transição 150ms ease, active
// scale(0.98). `disabled` nativo do <button> -- nenhum clique (nem por teclado)
// chega ao onClick enquanto desabilitado ou carregando; não precisa de lógica extra
// para bloquear.
export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [styles.button, styles[variant], className].filter(Boolean).join(' ')

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner size="sm" label="Carregando" />}
      {children}
    </button>
  )
}
