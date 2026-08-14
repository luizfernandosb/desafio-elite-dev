import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Skeleton } from '../../../components'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { EventCarousel } from '../components/EventCarousel'
import { EventList } from '../components/EventList'
import { HeroCarousel } from '../components/HeroCarousel'
import { SearchBar } from '../components/SearchBar'
import { catalogKeys, listPublicEvents } from '../api'
import styles from './CatalogPage.module.css'

// Sem um sinal de "destaque"/"em cartaz" no back -- destaque é simplesmente a
// primeira página da listagem pública sem filtro algum, sempre a mesma para
// qualquer visitante. Os 5 primeiros viram slide do hero; os 10 primeiros
// alimentam o carrossel "Em cartaz" logo abaixo.
const FEATURED_LIMIT = 10
const HERO_SLIDE_COUNT = 5
const ALL_SESSIONS_ID = 'todas-sessoes'

// Estado de busca/filtro inteiro na URL (não só `?q=`) -- um link colado ou um F5
// reproduz exatamente a mesma tela (§ etapa 05, "resultado é compartilhável e
// sobrevive a F5"). Filtrar usa `replace: true` -- não deveria empilhar uma entrada
// de histórico por tecla/clique; paginar usa o push normal, então o botão "voltar"
// do navegador desfolha página a página, não filtro a filtro.
export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const page = Number(searchParams.get('page') ?? '1') || 1

  const { data: featured, isLoading: isFeaturedLoading } = useQuery({
    queryKey: catalogKeys.list({ page: 1, limit: FEATURED_LIMIT }),
    queryFn: () => listPublicEvents({ page: 1, limit: FEATURED_LIMIT }),
  })
  const featuredEvents = featured?.data ?? []

  function handleSearchCommit(value: string) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (value) params.set('q', value)
        else params.delete('q')
        params.delete('page') // busca nova -- volta para a primeira página
        return params
      },
      { replace: true },
    )
  }

  function handleDateRangeChange(range: { from: string; to: string }) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (range.from) params.set('from', range.from)
        else params.delete('from')
        if (range.to) params.set('to', range.to)
        else params.delete('to')
        params.delete('page')
        return params
      },
      { replace: true },
    )
  }

  function handlePageChange(nextPage: number) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      params.set('page', String(nextPage))
      return params
    })
  }

  function handleClearFilters() {
    setSearchParams({}, { replace: true })
  }

  function scrollToAllSessions() {
    document.getElementById(ALL_SESSIONS_ID)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className={styles.page}>
      {/* página precisa de um h1 (§ etapa 12, heading-order) -- visualmente oculto
          porque o hero abaixo já cumpre o papel de "abertura" da tela; o texto
          continua no DOM para leitor de tela e outras tecnologias assistivas. */}
      <h1 className="sr-only">Catálogo</h1>

      {isFeaturedLoading ? (
        <Skeleton height="420px" radius="md" />
      ) : (
        <HeroCarousel events={featuredEvents.slice(0, HERO_SLIDE_COUNT)} />
      )}

      {!isFeaturedLoading && <EventCarousel title="Em cartaz" events={featuredEvents} onSeeAll={scrollToAllSessions} />}

      <section id={ALL_SESSIONS_ID} className={styles.allSessions}>
        <h2>Todas as sessões</h2>
        <div className={styles.filters}>
          <SearchBar value={q} onCommit={handleSearchCommit} />
          <DateRangeFilter from={from} to={to} onChange={handleDateRangeChange} />
        </div>
        <EventList
          q={q}
          from={from}
          to={to}
          page={page}
          onPageChange={handlePageChange}
          onClearFilters={handleClearFilters}
        />
      </section>
    </div>
  )
}
