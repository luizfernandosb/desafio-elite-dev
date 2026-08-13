import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Button, EmptyState, ErrorState, EventCard, Pagination, Skeleton } from '../../../components'
import { formatEventDate } from '../../../shared/date'
import { formatMoney } from '../../../shared/money'
import { catalogKeys, listPublicEvents } from '../api'
import styles from './EventList.module.css'

interface EventListProps {
  q: string
  from: string
  to: string
  page: number
  onPageChange: (page: number) => void
  onClearFilters: () => void
}

// Primeiras 4 imagens da grade em `eager` (linha acima da dobra em qualquer largura
// razoável de tela) -- o resto entra em `loading="lazy"` (§ etapa 05, critério de
// Lighthouse "poucas imagens grandes, loading=lazy fora da primeira dobra").
const EAGER_CARD_COUNT = 4

export function EventList({ q, from, to, page, onPageChange, onClearFilters }: EventListProps) {
  const hasFilter = Boolean(q || from || to)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: catalogKeys.list({ q, from, to, page }),
    queryFn: () => listPublicEvents({ q: q || undefined, from: from || undefined, to: to || undefined, page }),
  })

  // Carregando: skeleton de card, não spinner central -- evita layout shift quando os
  // dados chegam (§ etapa 05, "estados").
  if (isLoading) {
    return (
      <div className={styles.grid} aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} height="100%" radius="md" className={styles.skeletonCard} />
        ))}
      </div>
    )
  }

  // Erro de infraestrutura (rede, 500, timeout) -- `ErrorState` central (§ etapa 11),
  // não mais um `<Card>` com `role="alert"` reimplementado aqui. Filtro sem
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
      // cenário real se o seed não rodou (§ etapa 05) -- mensagem que não parece bug
      <EmptyState
        title="Nenhuma sessão publicada ainda"
        description="Volte em breve - novas sessões aparecem aqui assim que forem publicadas."
      />
    )
  }

  return (
    <>
      <div className={styles.grid}>
        {data.data.map((event, index) => (
          <Link key={event.id} to={`/eventos/${event.id}`} className={styles.cardLink}>
            <EventCard
              imageUrl={event.imageUrl}
              title={event.title}
              subtitle={formatEventDate(event.startsAt, event.timezone)}
              meta={`${event.venueName} - ${event.venueCity}`}
              priceLabel={`A partir de ${formatMoney(event.priceInCents, event.currency)}`}
              badge={event.genres[0]}
              eager={index < EAGER_CARD_COUNT}
            />
          </Link>
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
