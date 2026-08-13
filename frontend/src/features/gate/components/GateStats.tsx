import { useQuery } from '@tanstack/react-query'
import { ErrorState, Skeleton } from '../../../components'
import { useQueryState } from '../../../shared/useQueryState'
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
  const query = useQuery({
    queryKey: gateKeys.stats(eventId),
    queryFn: () => getGateStats(eventId),
    refetchInterval: REFRESH_MS,
  })
  // nunca "vazio" -- `total: 0` (evento sem ingressos) ainda é conteúdo válido a
  // mostrar, não ausência de dado (§ etapa 11: antes desta etapa, um 500 aqui
  // deixava o skeleton para sempre, sem nunca virar erro visível -- `isLoading ||
  // !data` nunca saía de `true` depois que a query esgotava os retries)
  const state = useQueryState(query, () => false)

  if (state.status === 'loading') {
    return <Skeleton height="72px" radius="md" />
  }

  if (state.status === 'error') {
    return <ErrorState error={state.error} onRetry={() => query.refetch()} />
  }

  if (state.status !== 'content') return null // inalcançável (isEmpty sempre false) -- só para o TS

  const data = state.data

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
