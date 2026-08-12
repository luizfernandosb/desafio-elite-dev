import { useCallback, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ToastContext, type ToastItem, type ToastVariant } from './toast-context'
import styles from './Toast.module.css'

const AUTO_DISMISS_MS = 5000

// Do zero, não Radix -- só Dialog e Tabs usam primitiva pronta nesta etapa (§ etapa
// 02). `role="status"`/`aria-live="polite"` no viewport inteiro (mesmo padrão do
// live region do mapa de assentos, §5.1.2): anuncia sem interromper o que a pessoa
// estava fazendo, e sem roubar foco -- diferente de um Dialog, o toast não precisa
// (e não deve) prender o foco do teclado.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'default') => {
      const id = crypto.randomUUID()
      setToasts((current) => [...current, { id, message, variant }])
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(
        <div className={styles.viewport} role="status" aria-live="polite" aria-atomic="false">
          {toasts.map((toast) => (
            <div key={toast.id} className={`${styles.toast} ${styles[toast.variant]}`}>
              <p className={styles.message}>{toast.message}</p>
              <button
                type="button"
                className={styles.dismiss}
                aria-label="Fechar notificação"
                onClick={() => dismiss(toast.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}
