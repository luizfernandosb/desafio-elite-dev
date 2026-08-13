import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorBoundary } from '../../../app/ErrorBoundary'
import { EmptyState, ErrorState, SeatMap, Skeleton, type SeatMapRow } from '../../../components'
import { formatEventDate } from '../../../shared/date'
import { applySeatPatch } from '../applySeatPatch'
import { getEvent, getSeatmap, reservaKeys, type Seatmap, type SeatHold } from '../api'
import { ConnectionBadge } from '../components/ConnectionBadge'
import { HoldExpiredModal } from '../components/HoldExpiredModal'
import { SelectionBar } from '../components/SelectionBar'
import { useHold } from '../useHold'
import { isOwnSeatChange, useLiveAnnouncements } from '../useLiveAnnouncements'
import { usePollingFallback } from '../usePollingFallback'
import { useSeatRealtime } from '../useSeatRealtime'
import { useSeatSelection } from '../useSeatSelection'
import styles from './SeatSelectionPage.module.css'

export default function SeatSelectionPage() {
  const { id } = useParams<{ id: string }>()
  const eventId = id ?? ''
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [hold, setHold] = useState<SeatHold[] | null>(null)
  const [holdExpired, setHoldExpired] = useState(false)
  const selection = useSeatSelection()
  const { announcement, announce } = useLiveAnnouncements()

  const {
    data: event,
    isLoading: isEventLoading,
    isError: isEventError,
    error: eventError,
    refetch: refetchEvent,
  } = useQuery({
    queryKey: reservaKeys.event(eventId),
    queryFn: () => getEvent(eventId),
    enabled: Boolean(eventId),
  })

  const {
    data: seatmap,
    isLoading: isSeatmapLoading,
    isError: isSeatmapError,
    error: seatmapError,
    refetch: refetchSeatmap,
  } = useQuery({
    queryKey: reservaKeys.seatmap(eventId),
    queryFn: () => getSeatmap(eventId),
    enabled: Boolean(eventId),
  })

  // rótulo ("F12") <-> id real do assento (o que o back exige em `seatIds`) -- o
  // SeatMap (componente compartilhado) só conhece rótulos, nunca ids (§ etapa 04).
  const { idByLabel, labelById } = useMemo(() => {
    const idByLabelMap = new Map<string, string>()
    const labelByIdMap = new Map<string, string>()
    for (const row of seatmap?.rows ?? []) {
      for (const seat of row.seats) {
        const label = `${row.row}${seat.number}`
        idByLabelMap.set(label, seat.id)
        labelByIdMap.set(seat.id, label)
      }
    }
    return { idByLabel: idByLabelMap, labelById: labelByIdMap }
  }, [seatmap])

  // Leitura, nunca decisão (§ etapa 07, "o princípio que não pode ser violado"): só
  // aplica o patch no snapshot local e, se não for um assento do PRÓPRIO usuário,
  // anuncia. O botão de reservar continua dependendo só do retorno de `POST /holds`
  // (`useHold`, etapa 06) -- nunca do que chega por aqui.
  const connectionStatus = useSeatRealtime(eventId, (patch) => {
    queryClient.setQueryData(reservaKeys.seatmap(eventId), (old: Seatmap | undefined) =>
      old ? applySeatPatch(old, patch) : old,
    )

    const ownSeatIds = [...selection.selectedSeatIds, ...(hold?.map((h) => h.seatId) ?? [])]
    if (isOwnSeatChange(patch.seatId, ownSeatIds)) return // já anunciado pelo próprio clique

    const label = labelById.get(patch.seatId)
    if (label) announce({ seatId: patch.seatId, label, status: patch.status })
  })
  usePollingFallback(connectionStatus, eventId)

  const mapRows: SeatMapRow[] = useMemo(
    () =>
      (seatmap?.rows ?? []).map((row) => ({
        row: row.row,
        seats: row.seats.map((seat) => ({
          label: `${row.row}${seat.number}`,
          status: seat.status,
          selected: selection.selectedSeatIds.includes(seat.id),
        })),
      })),
    [seatmap, selection.selectedSeatIds],
  )

  const { hold: createHold, isPending: isReserving } = useHold({
    eventId,
    onHoldCreated: (createdHold) => {
      setHold(createdHold)
      selection.clear() // seleção "consumida" -- o hold confirmado é a nova fonte de verdade
      // sem isto, o grid continua mostrando os assentos recém-reservados como
      // "livre" (dado velho da última leitura do snapshot) até a próxima ação
      // disparar um refetch -- confuso bastando um olhar rápido para a tela
      void queryClient.invalidateQueries({ queryKey: reservaKeys.seatmap(eventId) })
    },
    onSeatsTaken: (takenSeatIds) => {
      selection.removeMany(takenSeatIds)
      void queryClient.invalidateQueries({ queryKey: reservaKeys.seatmap(eventId) })
    },
  })

  function handleSeatClick(label: string) {
    const seatId = idByLabel.get(label)
    if (seatId) selection.toggle(seatId)
  }

  function handleReserve() {
    if (selection.selectedSeatIds.length > 0) createHold(selection.selectedSeatIds)
  }

  function handleExpire() {
    setHold(null)
    setHoldExpired(true)
  }

  function handleChooseAgain() {
    setHoldExpired(false)
    setHold(null)
    void queryClient.invalidateQueries({ queryKey: reservaKeys.seatmap(eventId) })
  }

  function handleProceed() {
    if (!hold) return
    navigate('/checkout/novo', { state: { eventId, holdIds: hold.map((h) => h.id) } })
  }

  if (isEventLoading || isSeatmapLoading) {
    return (
      <div className={styles.page}>
        <Skeleton height="28px" width="50%" />
        <Skeleton height="400px" radius="md" />
      </div>
    )
  }

  if (isEventError || isSeatmapError || !event || !seatmap) {
    return (
      <div className={styles.page}>
        <ErrorState
          error={eventError ?? seatmapError}
          onRetry={() => {
            void refetchEvent()
            void refetchSeatmap()
          }}
        />
        <Link to={`/eventos/${eventId}`}>Voltar para a sessão</Link>
      </div>
    )
  }

  const isPast = new Date(event.startsAt).getTime() <= Date.now()
  if (event.status !== 'PUBLISHED' || isPast) {
    return (
      <div className={styles.page}>
        <EmptyState
          title="Esta sessão não está mais disponível para reserva"
          description={event.status !== 'PUBLISHED' ? 'A sessão foi cancelada.' : 'A sessão já ocorreu.'}
          action={<Link to={`/eventos/${eventId}`}>Voltar para a sessão</Link>}
        />
      </div>
    )
  }

  const selectedLabels = selection.selectedSeatIds
    .map((seatId) => labelById.get(seatId))
    .filter((label): label is string => Boolean(label))

  return (
    <div className={styles.page}>
      <div>
        <h1>{event.title}</h1>
        <p className={styles.meta}>
          {formatEventDate(event.startsAt, event.timezone)} - {event.venueName}, {event.venueCity}
        </p>
      </div>

      <div className={styles.mapHeader}>
        <ConnectionBadge status={connectionStatus} />
      </div>

      {/* Boundary por seção (§ etapa 11) -- um erro de render no mapa (a parte mais
          densa desta tela: grade dinâmica, patches de realtime) some só com o mapa,
          nunca com o header/nav do resto da aplicação (não há `errorElement` de
          rota entre esta página e a raiz). */}
      <ErrorBoundary>
        <SeatMap
          rows={mapRows}
          onSeatClick={handleSeatClick}
          legend
          ariaLabel={`Mapa de assentos - ${event.venueName}`}
        />
      </ErrorBoundary>

      {/* preparada na etapa 06, alimentada aqui: só mudanças de OUTROS assentos,
          nunca a própria seleção (já anunciada pelo clique em si) */}
      <div role="status" aria-live="polite" aria-atomic="false" className="sr-only">
        {announcement}
      </div>

      <SelectionBar
        selectedLabels={selectedLabels}
        priceInCents={seatmap.meta.priceInCents}
        currency={seatmap.meta.currency}
        onReserve={handleReserve}
        isReserving={isReserving}
        atMax={selection.atMax}
        hold={hold}
        onExpire={handleExpire}
        onProceed={handleProceed}
      />

      <HoldExpiredModal open={holdExpired} onChooseAgain={handleChooseAgain} />
    </div>
  )
}
