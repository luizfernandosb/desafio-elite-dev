import { useQuery } from '@tanstack/react-query'
import { Button, EmptyState, ErrorState, Pagination, Skeleton } from '../../../components'
import { catalogKeys, listPublicEvents } from '../api'
import { groupEventsByMovie } from '../groupByMovie'
import { SearchResultCard } from './SearchResultCard'
import styles from './EventList.module.css'

interface EventListProps {
  q: string
  from: string
  to: string
  page: number
  onPageChange: (page: number) => void
  onClearFilters: () => void
}

// Primeiras linhas em `eager` (acima da dobra em qualquer largura razoável de tela)
// -- o resto entra em `loading="lazy"` (critério de Lighthouse "poucas imagens
// grandes, loading=lazy fora da primeira dobra").
const EAGER_CARD_COUNT = 4
const SKELETON_ROW_COUNT = 6

export function EventList({ q, from, to, page, onPageChange, onClearFilters }: EventListProps) {
  const hasFilter = Boolean(q || from || to)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: catalogKeys.list({ q, from, to, page }),
    queryFn: () => listPublicEvents({ q: q || undefined, from: from || undefined, to: to || undefined, page }),
  })

  // Carregando: skeleton de linha, não spinner central -- evita layout shift quando
  // os dados chegam.
  if (isLoading) {
    return (
      <div className={styles.grid} aria-hidden="true">
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
          <Skeleton key={index} height="132px" radius="md" />
        ))}
      </div>
    )
  }

  // Erro de infraestrutura (rede, 500, timeout) -- `ErrorState` central. Filtro sem
  // resultado (abaixo) continua `EmptyState`: é ausência de dado, não falha de
  // requisição -- os dois nunca se confundem.
  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} />
  }

  if (!data || data.data.length === 0) {
    return hasFilter ? (
      <EmptyState
        title={q ? `Nenhum resultado para "${q}"` : 'Nenhum resultado para os filtros aplicados'}
        description="Ajuste a busca ou o intervalo de data."
        action={
          <Button variant="secondary" onClick={onClearFilters}>
            Limpar filtros
          </Button>
        }
      />
    ) : (
      // cenário real se o seed não rodou -- mensagem que não parece bug
      <EmptyState
        title="Nenhuma sessão publicada ainda"
        description="Volte em breve - novas sessões aparecem aqui assim que forem publicadas."
      />
    )
  }

  // Um filme com várias sessões nesta página (horário/sala/formato diferentes)
  // aparece UMA vez, nunca um card repetido por sessão -- as diferenças continuam
  // visíveis ao entrar no filme (`EventDetailPage`), e o card aqui sinaliza quantas
  // sessões existem (`sessionCount`) quando há mais de uma.
  const movies = groupEventsByMovie(data.data)

  return (
    <>
      <div className={styles.grid}>
        {movies.map((group, index) => (
          <SearchResultCard
            key={group.key}
            event={group.primary}
            sessionCount={group.sessionCount}
            eager={index < EAGER_CARD_COUNT}
          />
        ))}
      </div>
      <Pagination
        page={data.meta.page}
        totalPages={data.meta.totalPages}
        hasPrev={data.meta.hasPrev}
        hasNext={data.meta.hasNext}
        onPageChange={onPageChange}
      />
    </>
  )
}
