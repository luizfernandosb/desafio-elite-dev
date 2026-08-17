import { useQuery } from '@tanstack/react-query'
import { ErrorState, Skeleton } from '../../../components'
import { useQueryState } from '../../../shared/useQueryState'
import { gateKeys, getGateStats } from '../api'
import { resultIcon, resultTone } from '../status'
import styles from './GateStats.module.css'

interface GateStatsPanelProps {
  eventId: string
}

const REFRESH_MS = 10_000

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(new Date(iso))
}

export function GateStatsPanel({ eventId }: GateStatsPanelProps) {
  const query = useQuery({
    queryKey: gateKeys.stats(eventId),
    queryFn: () => getGateStats(eventId),
    refetchInterval: REFRESH_MS,
  })
  const state = useQueryState(query, () => false)

  if (state.status === 'loading') {
    return <Skeleton height="72px" radius="md" />
  }

  if (state.status === 'error') {
    return <ErrorState error={state.error} onRetry={() => query.refetch()} />
  }

  if (state.status !== 'content') return null

  const data = state.data

  return (
    <div className={styles.panel}>
      <p className={styles.counter}>
        <strong>
          {data.used} de {data.total}
        </strong>{' '}
        validados
        <span className={styles.remaining}> - {data.remaining} restantes</span>
      </p>

      {data.lastValidations.length > 0 && (
        <ul className={styles.feed} aria-label="Últimas validações">
          {data.lastValidations.map((entry, index) => (
            <li
              key={`${entry.ticketId ?? 'sem-ticket'}-${entry.createdAt}-${index}`}
              className={styles.feedItem}
            >
              <span className={`${styles.dot} ${styles[resultTone(entry.result)]}`} aria-hidden="true">
                {resultIcon(entry.result)}
              </span>
              <span className={styles.feedTime}>{formatTime(entry.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
