import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Badge, ErrorState, Skeleton } from '../../../components'
import { useAuth } from '../../auth/useAuth'
import { toEventDateKey } from '../../../shared/date'
import { formatMoney } from '../../../shared/money'
import { ShowtimePicker } from '../components/ShowtimePicker'
import { catalogKeys, getPublicEvent, listPublicEvents } from '../api'
import { buildShowtimesByDay, defaultDayTabKey, type ShowtimeGroup } from '../showtimes'
import styles from './EventDetailPage.module.css'

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const eventId = id ?? ''
  const { status: authStatus } = useAuth()
  const [selectedDayKey, setSelectedDayKey] = useState('')

  const {
    data: event,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: catalogKeys.detail(eventId),
    queryFn: () => getPublicEvent(eventId),
    enabled: Boolean(eventId),
  })

  const listParams = { externalId: event?.externalId, limit: 100 }
  const { data: siblings, isLoading: isLoadingSiblings } = useQuery({
    queryKey: catalogKeys.list(listParams),
    queryFn: () => listPublicEvents(listParams),
    enabled: Boolean(event),
  })

  const { dayTabs, groupsByDay } = event
    ? buildShowtimesByDay(siblings?.data ?? [], event.timezone)
    : { dayTabs: [], groupsByDay: new Map<string, ShowtimeGroup[]>() }

  useEffect(() => {
    if (!event || isLoadingSiblings || dayTabs.length === 0) return
    setSelectedDayKey((prev) => {
      if (prev && dayTabs.some((tab) => tab.key === prev)) return prev
      return defaultDayTabKey(dayTabs, groupsByDay, toEventDateKey(event.startsAt, event.timezone))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, isLoadingSiblings, siblings])

  if (isLoading) {
    return (
      <div className={styles.page}>
        <Skeleton height="360px" radius="md" />
        <Skeleton height="32px" width="60%" />
        <Skeleton height="20px" width="40%" />
      </div>
    )
  }

  if (isError || !event) {
    return (
      <div className={styles.page}>
        <ErrorState error={error} onRetry={() => refetch()} />
        <Link to="/">Voltar para o catálogo</Link>
      </div>
    )
  }

  const upcomingSessions = Array.from(groupsByDay.values()).flatMap((groups) =>
    groups.flatMap((group) => group.sessions),
  )
  const fromPriceInCents =
    upcomingSessions.length > 0
      ? Math.min(...upcomingSessions.map((session) => session.effectivePriceInCents))
      : event.effectivePriceInCents

  const isPast = new Date(event.startsAt).getTime() <= Date.now()
  const isCancelled = event.status === 'CANCELLED'

  function hrefForSession(sessionId: string): string {
    const seatsPath = `/eventos/${sessionId}/assentos`
    return authStatus === 'authenticated' ? seatsPath : `/entrar?redirect=${encodeURIComponent(seatsPath)}`
  }

  return (
    <div className={styles.page}>
      {event.imageUrl && <img src={event.imageUrl} alt="" className={styles.poster} />}

      {isCancelled && (
        <p className={styles.statusBanner} role="status">
          A sessão que você abriu foi cancelada.
        </p>
      )}
      {!isCancelled && isPast && (
        <p className={styles.statusBanner} role="status">
          A sessão que você abriu já ocorreu.
        </p>
      )}

      <h1>{event.title}</h1>

      <div className={styles.badges}>
        {event.genres.map((genre) => (
          <Badge key={genre}>{genre}</Badge>
        ))}
        {event.runtimeMinutes && <Badge>{event.runtimeMinutes} min</Badge>}
      </div>

      {event.synopsis && <p className={styles.synopsis}>{event.synopsis}</p>}

      <p className={styles.price}>A partir de {formatMoney(fromPriceInCents, event.currency)}</p>

      {isLoadingSiblings ? (
        <Skeleton height="120px" radius="md" />
      ) : (
        <ShowtimePicker
          dayTabs={dayTabs}
          groupsByDay={groupsByDay}
          selectedDayKey={selectedDayKey}
          onSelectDay={setSelectedDayKey}
          hrefForSession={hrefForSession}
        />
      )}
    </div>
  )
}
