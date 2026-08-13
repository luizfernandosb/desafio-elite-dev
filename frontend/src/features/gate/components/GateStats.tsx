import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '../../../components'
import { gateKeys, getGateStats } from '../api'
import { resultIcon, resultTone } from '../status'
import styles from './GateStats.module.css'

interface GateStatsPanelProps {
  eventId: string
}

// Sem canal realtime aqui (fora do escopo desta etapa) -- um refetch periódico
// simples já resolve "contador visível sem clique extra" quando há mais de um posto
// no mesmo evento; a própria validação também invalida esta query na hora
// (`useGateValidation`), então o operador vê o próprio resultado sem esperar o poll.
const REFRESH_MS = 10_000

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(new Date(iso))
}

export function GateStatsPanel({ eventId }: GateStatsPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: gateKeys.stats(eventId),
    queryFn: () => getGateStats(eventId),
    refetchInterval: REFRESH_MS,
  })

  if (isLoading || !data) {
    return <Skeleton height="72px" radius="md" />
  }

  return (
    <div className={styles.panel}>
      <p className={styles.counter}>
        <strong>
          {data.used} de {data.total}
        </strong>{' '}
        validados
        <span className={styles.remaining}> -- {data.remaining} restantes</span>
      </p>

      {/* `GateStats.lastValidations` do back não inclui assento (`gate.service.ts`,
          `GateStats.lastValidations: { result, createdAt, ticketId }`) -- diferente
          do "resultado, assento, horário" do plano original; o feed mostra o que a
          API de fato manda, sem inventar uma segunda chamada por ingresso só para
          completar o assento de uma lista de contexto. */}
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
