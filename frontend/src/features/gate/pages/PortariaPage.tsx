import { useState } from 'react'
import { ErrorBoundary } from '../../../app/ErrorBoundary'
import { Button } from '../../../components'
import { useAuth } from '../../auth/useAuth'
import { EventPicker } from '../components/EventPicker'
import { GateScanner } from '../components/GateScanner'
import { GateStatsPanel } from '../components/GateStats'
import { ManualEntry } from '../components/ManualEntry'
import { ValidationResultScreen } from '../components/ValidationResultScreen'
import { useGateValidation } from '../useGateValidation'
import styles from './PortariaPage.module.css'

export default function PortariaPage() {
  const { logout } = useAuth()
  const [eventId, setEventId] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const { submit, busy, result, dismiss } = useGateValidation(eventId)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.picker}>
          <EventPicker value={eventId} onChange={setEventId} />
        </div>
        <div className={styles.headerActions}>
          <Button variant="ghost" aria-pressed={muted} onClick={() => setMuted((current) => !current)}>
            {muted ? 'Som desligado' : 'Som ligado'}
          </Button>
          <Button variant="ghost" onClick={() => void logout()}>
            Sair
          </Button>
        </div>
      </header>

      {eventId ? (
        <div className={styles.body}>
          <GateStatsPanel eventId={eventId} />

          <ErrorBoundary>
            <GateScanner paused={busy} onScan={submit} />
          </ErrorBoundary>

          <ManualEntry disabled={busy} onSubmit={submit} />
        </div>
      ) : (
        <p className={styles.notice}>Selecione a sessão deste posto para começar a validar ingressos.</p>
      )}

      {result && <ValidationResultScreen response={result} muted={muted} onDismiss={dismiss} />}
    </div>
  )
}
