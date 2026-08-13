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

// Componente central da etapa 11 -- toda tela que depende do servidor usa isto para
// o estado de erro de INFRAESTRUTURA (rede, timeout, 500, rate limit). Erro de
// NEGÓCIO esperado (409/SEAT_TAKEN, recusa de pagamento, "já utilizado" na
// portaria) continua com tela própria, desenhada para aquele significado -- nunca
// este componente por cima (misturar os dois faz "já utilizado" parecer bug).
export function ErrorState({ error, onRetry }: ErrorStateProps) {
  // `useContext` direto, não o `useToast()` que lança sem provider -- `ErrorState`
  // aparece em toda tela que consome API (é o componente mais reaproveitado desta
  // etapa); exigir `<ToastProvider>` como pré-condição obrigatória o acoplaria a um
  // provider específico só por causa do toast de "copiado", uma melhoria, não o
  // motivo de existir do componente. Sem provider, a cópia ainda funciona -- só o
  // toast de confirmação não aparece.
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

      {/* ponte entre "algo deu errado" no front e o log correlato no back (§5.5.7)
          -- sem isto, todo 500 reportado vira "não funcionou", sem como localizar */}
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
