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
