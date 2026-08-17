import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorState, Skeleton } from '../../../components'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { EventCarousel } from '../components/EventCarousel'
import { EventList } from '../components/EventList'
import { HeroCarousel } from '../components/HeroCarousel'
import { SearchBar } from '../components/SearchBar'
import { catalogKeys, listPublicEvents } from '../api'
import { groupEventsByMovie } from '../groupByMovie'
import styles from './CatalogPage.module.css'

const EVENTS_LIMIT = 100
const HERO_SLIDE_COUNT = 5
const ALL_SESSIONS_ID = 'todas-sessoes'

export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const page = Number(searchParams.get('page') ?? '1') || 1

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

  function handleSearchCommit(value: string) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (value) params.set('q', value)
        else params.delete('q')
        params.delete('page')
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

  const movies = events ? groupEventsByMovie(events.data).map((group) => group.primary) : []

  return (
    <div className={styles.page}>
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
            <HeroCarousel events={movies.slice(0, HERO_SLIDE_COUNT)} />
            <EventCarousel title="Em cartaz" events={movies} onSeeAll={scrollToAllSessions} />
          </>
        ))}

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
