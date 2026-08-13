import { useEffect } from 'react'
import type { GateValidationResponse } from '../api'
import { playResultSound } from '../sound'
import { resultIcon, resultTone } from '../status'
import styles from './ValidationResultScreen.module.css'

const DISPLAY_MS = 2000

interface ValidationResultScreenProps {
  response: GateValidationResponse
  muted: boolean
  onDismiss: () => void
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(new Date(iso))
}

// Tela cheia por ~2s, nunca um toast pequeno (§ etapa 10) -- em fila com pressa e luz
// ruim, um resultado discreto é um resultado perdido. `onDismiss` (chamado sozinho
// aqui) é a mesma peça que libera a próxima leitura em `useGateValidation` -- a pausa
// pós-leitura do plano nasce do tempo que este componente fica montado, sem um
// segundo temporizador em outro lugar.
export function ValidationResultScreen({ response, muted, onDismiss }: ValidationResultScreenProps) {
  const tone = resultTone(response.result)

  useEffect(() => {
    const timer = setTimeout(onDismiss, DISPLAY_MS)
    return () => clearTimeout(timer)
  }, [onDismiss])

  useEffect(() => {
    if (!muted) playResultSound(tone)
    // dispara só quando o RESULTADO muda -- alternar o mute durante a exibição não
    // deve retocar o som do resultado já anunciado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response])

  return (
    <div className={`${styles.overlay} ${styles[tone]}`} role="alert" aria-live="assertive">
      <div className={styles.icon} aria-hidden="true">
        {resultIcon(response.result)}
      </div>
      <p className={styles.message}>{response.message}</p>

      {response.ticket && (
        <div className={styles.details}>
          <p className={styles.eventTitle}>{response.ticket.eventTitle}</p>
          {response.ticket.seat && <p className={styles.seat}>Assento {response.ticket.seat}</p>}
        </div>
      )}

      {response.result === 'ALREADY_USED' && response.usedAt && (
        <p className={styles.extra}>
          Validado às {formatTime(response.usedAt)}
          {response.validatedBy ? ` por ${response.validatedBy}` : ''}
        </p>
      )}
    </div>
  )
}
