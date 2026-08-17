import { useContext } from 'react'
import { describeError } from '../shared/errors'
import { Button } from './Button'
import { Card } from './Card'
import { ToastContext } from './toast-context'
import styles from './ErrorState.module.css'

interface ErrorStateProps {
  error: unknown
  onRetry?: () => void
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const toast = useContext(ToastContext)
  const { title, message, showRetry, requestId } = describeError(error)

  async function handleCopyRequestId() {
    if (!requestId) return
    await navigator.clipboard.writeText(requestId)
    toast?.showToast('Código copiado.', 'success')
  }

  return (
    <Card role="alert" className={styles.card}>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.message}>{message}</p>

      {requestId && (
        <button type="button" className={styles.requestId} onClick={() => void handleCopyRequestId()}>
          Código de referência: <code>{requestId}</code>
        </button>
      )}

      {showRetry && onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </Card>
  )
}
