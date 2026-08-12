import { useState, type ChangeEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  Input,
  SeatMap,
  Skeleton,
  useToast,
  type SeatMapRow,
} from '../../../components'
import {
  cancelEvent,
  getEvent,
  getEventSeatmap,
  organizadorKeys,
  publishEvent,
  removeEventImage,
  uploadEventImage,
  type EventSeatmap,
  type OrganizerEvent,
} from '../api'
import { eventErrorMessage, imageErrorMessage } from '../error-messages'
import { eventStatusLabel } from '../status'
import { EventEditForm } from './EventEditForm'
import styles from './EventDetailPage.module.css'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const INVALID_IMAGE_MESSAGE = 'Imagem inválida -- use JPEG, PNG ou WebP de até 5 MB.'

function buildOccupancyRows(seatmap: EventSeatmap): SeatMapRow[] {
  return seatmap.rows.map((row) => ({
    row: row.row,
    seats: row.seats.map((seat) => ({
      label: `${row.row}${seat.number}`,
      accessible: seat.kind !== 'REGULAR',
      status: seat.status,
    })),
  }))
}

function PublishEventDialog({ event }: { event: OrganizerEvent }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => publishEvent(event.id),
    onSuccess: (updated) => {
      queryClient.setQueryData(organizadorKeys.eventDetail(event.id), updated)
      void queryClient.invalidateQueries({ queryKey: organizadorKeys.events() })
      showToast('Sessão publicada.', 'success')
      setOpen(false)
    },
  })

  return (
    <Dialog
      trigger={<Button>Publicar</Button>}
      title="Publicar sessão"
      description="A sessão passa a ser visível e vendável no catálogo público."
      open={open}
      onOpenChange={setOpen}
    >
      {error && (
        <p role="alert" className={styles.formError}>
          {eventErrorMessage(error)}
        </p>
      )}
      <Button loading={isPending} onClick={() => mutate()}>
        Confirmar publicação
      </Button>
    </Dialog>
  )
}

// Confirmação por digitação do nome da sessão (§ etapa 04) -- cancelamento é
// irreversível e sem estorno nesta versão; o diálogo diz isso, não só o README.
function CancelEventDialog({ event }: { event: OrganizerEvent }) {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => cancelEvent(event.id),
    onSuccess: (updated) => {
      queryClient.setQueryData(organizadorKeys.eventDetail(event.id), updated)
      void queryClient.invalidateQueries({ queryKey: organizadorKeys.events() })
      showToast('Sessão cancelada.', 'success')
      setOpen(false)
      setConfirmText('')
    },
  })

  const canConfirm = confirmText.trim() === event.title

  return (
    <Dialog
      trigger={<Button variant="danger">Cancelar sessão</Button>}
      title="Cancelar sessão"
      description="Ação irreversível e sem estorno nesta versão -- ingressos já vendidos não são reembolsados automaticamente."
      open={open}
      onOpenChange={setOpen}
    >
      <div className={styles.dialogBody}>
        {error && (
          <p role="alert" className={styles.formError}>
            {eventErrorMessage(error)}
          </p>
        )}
        <Input
          label={`Digite "${event.title}" para confirmar`}
          value={confirmText}
          onChange={(changeEvent) => setConfirmText(changeEvent.target.value)}
        />
        <Button variant="danger" disabled={!canConfirm} loading={isPending} onClick={() => mutate()}>
          Confirmar cancelamento
        </Button>
      </div>
    </Dialog>
  )
}

function EventImageSection({ event }: { event: OrganizerEvent }) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [localError, setLocalError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadEventImage(event.id, file),
    onSuccess: (updated) => {
      queryClient.setQueryData(organizadorKeys.eventDetail(event.id), updated)
      showToast('Imagem atualizada.', 'success')
      setPreviewUrl(null)
    },
    onError: (err) => setLocalError(imageErrorMessage(err)),
  })

  const removeMutation = useMutation({
    mutationFn: () => removeEventImage(event.id),
    onSuccess: (updated) => {
      queryClient.setQueryData(organizadorKeys.eventDetail(event.id), updated)
      showToast('Capa removida -- pôster do catálogo restaurado.', 'success')
    },
  })

  function handleFileChange(changeEvent: ChangeEvent<HTMLInputElement>) {
    const file = changeEvent.target.files?.[0]
    if (!file) return
    setLocalError(null)

    // validado no cliente também (§ etapa 04, upload de imagem) -- deixar subir
    // 5 MB para receber 400 é desperdício de tempo do organizador
    if (file.size > MAX_IMAGE_BYTES || !ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setLocalError(INVALID_IMAGE_MESSAGE)
      changeEvent.target.value = ''
      return
    }

    setPreviewUrl(URL.createObjectURL(file))
    uploadMutation.mutate(file)
  }

  const hasCustomImage = Boolean(event.customImageKey)

  return (
    <section className={styles.imageSection}>
      <h2>Capa</h2>
      {(previewUrl ?? event.imageUrl) && (
        <img src={previewUrl ?? event.imageUrl} alt="" className={styles.poster} />
      )}
      {/* Corte nº 3 (§12.1): sem imagem própria, o pôster do TMDb cobre tudo */}
      {!hasCustomImage && <p className={styles.note}>Usando o pôster do TMDb -- envie uma imagem para substituí-lo.</p>}
      {localError && (
        <p role="alert" className={styles.formError}>
          {localError}
        </p>
      )}
      <div className={styles.imageActions}>
        <label className={styles.fileLabel}>
          {hasCustomImage ? 'Substituir capa' : 'Adicionar capa'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className={styles.fileInput}
            onChange={handleFileChange}
          />
        </label>
        {hasCustomImage && (
          <Button variant="secondary" onClick={() => removeMutation.mutate()} loading={removeMutation.isPending}>
            Remover capa
          </Button>
        )}
      </div>
    </section>
  )
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const eventId = id ?? ''

  const {
    data: event,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: organizadorKeys.eventDetail(eventId),
    queryFn: () => getEvent(eventId),
    enabled: Boolean(eventId),
  })

  const { data: seatmap } = useQuery({
    queryKey: organizadorKeys.eventSeatmap(eventId),
    queryFn: () => getEventSeatmap(eventId),
    enabled: Boolean(event),
  })

  if (isLoading) {
    return (
      <div className={styles.page}>
        <Skeleton height="32px" width="240px" />
        <Skeleton height="240px" radius="md" />
      </div>
    )
  }

  if (isError || !event) {
    return (
      <div className={styles.page}>
        <EmptyState
          title="Sessão não encontrada"
          description={error ? eventErrorMessage(error) : undefined}
        />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>{event.title}</h1>
          <Badge>{eventStatusLabel(event.status)}</Badge>
        </div>
        <div className={styles.headerActions}>
          {event.status === 'DRAFT' && <PublishEventDialog event={event} />}
          {event.status !== 'CANCELLED' && <CancelEventDialog event={event} />}
        </div>
      </div>

      <EventImageSection event={event} />

      {seatmap && (
        <section>
          <h2>Ocupação</h2>
          <SeatMap rows={buildOccupancyRows(seatmap)} legend />
        </section>
      )}

      <EventEditForm event={event} />
    </div>
  )
}
