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

export function ValidationResultScreen({ response, muted, onDismiss }: ValidationResultScreenProps) {
  const tone = resultTone(response.result)

  useEffect(() => {
    const timer = setTimeout(onDismiss, DISPLAY_MS)
    return () => clearTimeout(timer)
  }, [onDismiss])

  useEffect(() => {
    if (!muted) playResultSound(tone)
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
