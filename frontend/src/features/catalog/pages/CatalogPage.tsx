import { useQuery } from '@tanstack/react-query'
import { EmptyState, ErrorState, Skeleton } from '../../../components'
import { EventCarousel } from '../components/EventCarousel'
import { HeroCarousel } from '../components/HeroCarousel'
import { catalogKeys, listPublicEvents } from '../api'
import styles from './CatalogPage.module.css'

// Sem busca/filtro/grade paginada -- "Em cartaz" é a única forma de navegar o
// catálogo na home (decisão do usuário, removeu "Todas as sessões"). 100 é o teto
// de `limit` que o back aceita (shared/pagination.ts); sem paginação de verdade
// aqui, sessões além da centésima (por `startsAt`) não aparecem na home, só por
// link direto.
const EVENTS_LIMIT = 100
const HERO_SLIDE_COUNT = 5

export default function CatalogPage() {
  const {
    data: events,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: catalogKeys.list({ page: 1, limit: EVENTS_LIMIT }),
    queryFn: () => listPublicEvents({ page: 1, limit: EVENTS_LIMIT }),
  })

  return (
    <div className={styles.page}>
      {/* página precisa de um h1 (§ etapa 12, heading-order) -- visualmente oculto
          porque o hero abaixo já cumpre o papel de "abertura" da tela; o texto
          continua no DOM para leitor de tela e outras tecnologias assistivas. */}
      <h1 className="sr-only">Catálogo</h1>

      {isLoading && (
        <>
          <Skeleton height="420px" radius="md" />
          <Skeleton height="300px" radius="md" />
        </>
      )}

      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {!isLoading &&
        !isError &&
        events &&
        (events.data.length === 0 ? (
          <EmptyState
            title="Nenhuma sessão publicada ainda"
            description="Volte em breve - novas sessões aparecem aqui assim que forem publicadas."
          />
        ) : (
          <>
            <HeroCarousel events={events.data.slice(0, HERO_SLIDE_COUNT)} />
            <EventCarousel title="Em cartaz" events={events.data} />
          </>
        ))}
    </div>
  )
}
