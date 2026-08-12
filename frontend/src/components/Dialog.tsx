import type { ReactElement, ReactNode } from 'react'
import * as RadixDialog from '@radix-ui/react-dialog'
import styles from './Dialog.module.css'

interface DialogProps {
  trigger: ReactElement
  title: string
  description?: string
  children?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

// Foco preso, Esc fecha, foco volta ao gatilho ao fechar -- comportamento do Radix,
// não reimplementado aqui (§ etapa 02, "Radix apenas como primitiva sem estilo").
// A aparência (overlay, cartão, transição) é toda nossa, sobre os tokens do resto do
// sistema; --transition-slow (250ms) é usado só aqui, não no resto dos componentes.
export function Dialog({ trigger, title, description, children, open, onOpenChange }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content className={styles.content}>
          <RadixDialog.Title className={styles.title}>{title}</RadixDialog.Title>
          {description && <RadixDialog.Description className={styles.description}>{description}</RadixDialog.Description>}
          <div className={styles.body}>{children}</div>
          <RadixDialog.Close asChild>
            <button className={styles.close} aria-label="Fechar">
              ✕
            </button>
          </RadixDialog.Close>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
