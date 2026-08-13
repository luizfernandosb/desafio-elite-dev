import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useToast } from '../../../components'
import { createEvent, organizadorKeys, type CatalogItem, type CreateEventInput, type OrganizerEvent } from '../api'
import { eventErrorMessage } from '../error-messages'
import type { RoomStepValues, SlotValues, VenueStepValues } from '../schemas'
import { zonedWallTimeToUtcDate } from '../timezones'
import { MovieStep } from './wizard/MovieStep'
import { RoomStep } from './wizard/RoomStep'
import { VenueStep } from './wizard/VenueStep'
import styles from './CreateEventWizard.module.css'

// Chave única de rascunho -- um organizador só cria sessões de um lote de cada vez
// (não há suporte a múltiplos rascunhos concorrentes, e o plano só pede sobreviver a
// um F5 acidental, não abas paralelas).
const DRAFT_KEY = 'organizador:novo-evento:rascunho'

interface WizardDraft {
  movie: CatalogItem | null
  venueName: string
  venueCity: string
  venueState: string
  // um item por sessão a criar -- mesmo filme/local/sala/preço, horários diferentes
  slots: SlotValues[]
  timezone: string
  // '' até o passo 3 ser preenchido pela primeira vez -- os inputs usam
  // `valueAsNumber` (RoomStep.tsx), então um valor de verdade já chega como number.
  rows: number | ''
  seatsPerRow: number | ''
  priceInReais: number | ''
  accessibleSeats: string[]
  format: RoomStepValues['format']
  audio: RoomStepValues['audio']
  roomType: RoomStepValues['roomType']
  vipSurchargePercent: number | undefined
}

const EMPTY_DRAFT: WizardDraft = {
  movie: null,
  venueName: '',
  venueCity: '',
  venueState: '',
  slots: [{ date: '', time: '' }],
  timezone: 'America/Sao_Paulo',
  rows: '',
  seatsPerRow: '',
  priceInReais: '',
  accessibleSeats: [],
  format: 'TWO_D',
  audio: 'DUBBED',
  roomType: 'STANDARD',
  vipSurchargePercent: undefined,
}

function loadDraft(): WizardDraft {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return EMPTY_DRAFT
    return { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<WizardDraft>) }
  } catch {
    return EMPTY_DRAFT
  }
}

type WizardStep = 1 | 2 | 3

function clampStep(value: string | null): WizardStep {
  if (value === '2') return 2
  if (value === '3') return 3
  return 1
}

function buildCreateInput(draft: WizardDraft, roomValues: RoomStepValues, slot: SlotValues): CreateEventInput {
  const startsAt = zonedWallTimeToUtcDate(slot.date, slot.time, draft.timezone)
  return {
    source: draft.movie!.source,
    externalId: draft.movie!.externalId,
    venueName: draft.venueName,
    venueCity: draft.venueCity,
    venueState: draft.venueState,
    startsAt: startsAt.toISOString(),
    timezone: draft.timezone,
    priceInCents: Math.round(roomValues.priceInReais * 100),
    format: roomValues.format,
    audio: roomValues.audio,
    roomType: roomValues.roomType,
    vipSurchargePercent: roomValues.roomType === 'VIP' ? roomValues.vipSurchargePercent : undefined,
    layout: {
      rows: roomValues.rows,
      seatsPerRow: roomValues.seatsPerRow,
      accessibleSeats: draft.accessibleSeats,
    },
  }
}

// Assistente de criação em três passos (§ etapa 04): um formulário único com todos
// os campos é onde o organizador desiste. Estado na URL (`?passo=`) -- voltar no
// navegador funciona, recarregar não perde o passo; rascunho em sessionStorage (não é
// dado sensível) sobrevive a um F5 acidental. Só o passo 3 dispara `POST /events` --
// um por horário do passo 2 (mesmo filme/local/sala/preço), nunca um endpoint de lote:
// o cache de catálogo (back, `catalog.service.ts`) já evita N buscas repetidas do
// mesmo filme no TMDb, então N chamadas sequenciais ao endpoint de sempre bastam.
export default function CreateEventWizard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const step = clampStep(searchParams.get('passo'))
  const [draft, setDraft] = useState<WizardDraft>(loadDraft)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  useEffect(() => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  }, [draft])

  // acesso direto a ?passo=2/3 sem filme escolhido (ex.: link colado, sessão sem
  // rascunho) volta ao passo 1 -- o modelo exige `source` + `externalId` (§4.3)
  useEffect(() => {
    if (step > 1 && !draft.movie) {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev)
        params.set('passo', '1')
        return params
      })
    }
  }, [step, draft.movie, setSearchParams])

  function goToStep(next: WizardStep) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      params.set('passo', String(next))
      return params
    })
  }

  function handleMovieSelect(movie: CatalogItem | null) {
    setDraft((prev) => ({ ...prev, movie }))
  }

  function handleVenueSubmit(values: VenueStepValues) {
    setDraft((prev) => ({ ...prev, ...values }))
    goToStep(3)
  }

  async function handleRoomSubmit(values: RoomStepValues) {
    const nextDraft = {
      ...draft,
      rows: values.rows,
      seatsPerRow: values.seatsPerRow,
      priceInReais: values.priceInReais,
      format: values.format,
      audio: values.audio,
      roomType: values.roomType,
      vipSurchargePercent: values.vipSurchargePercent,
    }
    setDraft(nextDraft)

    if (!nextDraft.movie) {
      goToStep(1)
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    const attemptedSlots = nextDraft.slots
    const results = await Promise.allSettled(
      attemptedSlots.map((slot) => createEvent(buildCreateInput(nextDraft, values, slot))),
    )

    setIsSubmitting(false)
    void queryClient.invalidateQueries({ queryKey: organizadorKeys.events() })

    const succeeded = results.filter(
      (result): result is PromiseFulfilledResult<OrganizerEvent> => result.status === 'fulfilled',
    )
    const failedSlots = attemptedSlots.filter((_, index) => results[index]?.status === 'rejected')

    if (failedSlots.length === 0) {
      sessionStorage.removeItem(DRAFT_KEY)
      showToast(
        succeeded.length === 1 ? 'Sessão criada como rascunho.' : `${succeeded.length} sessões criadas como rascunho.`,
        'success',
      )
      navigate(
        succeeded.length === 1 ? `/organizador/eventos/${succeeded[0]!.value.id}` : '/organizador?status=DRAFT',
        { replace: true },
      )
      return
    }

    // Falha parcial ou total: mantém no rascunho só os horários que NÃO foram criados
    // -- um novo clique tenta de novo só esses, nunca recria os que já deram certo.
    setDraft((prev) => ({ ...prev, slots: failedSlots }))

    const firstRejection = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    )
    const reason = firstRejection ? eventErrorMessage(firstRejection.reason) : 'Não foi possível criar as sessões.'
    setSubmitError(
      succeeded.length > 0
        ? `${succeeded.length} de ${attemptedSlots.length} sessões criadas. ${failedSlots.length} falharam: ${reason} Corrija e tente de novo -- só os horários que falharam continuam no formulário.`
        : `Não foi possível criar a sessão: ${reason}`,
    )
  }

  function toggleAccessibleSeat(label: string) {
    setDraft((prev) => ({
      ...prev,
      accessibleSeats: prev.accessibleSeats.includes(label)
        ? prev.accessibleSeats.filter((seat) => seat !== label)
        : [...prev.accessibleSeats, label],
    }))
  }

  return (
    <div className={styles.page}>
      <h1>Nova sessão</h1>
      <ol className={styles.steps} aria-label="Passos da criação">
        <li aria-current={step === 1 ? 'step' : undefined}>1. Filme</li>
        <li aria-current={step === 2 ? 'step' : undefined}>2. Local e horário</li>
        <li aria-current={step === 3 ? 'step' : undefined}>3. Sala e preço</li>
      </ol>

      {step === 1 && (
        <MovieStep selected={draft.movie} onSelect={handleMovieSelect} onNext={() => draft.movie && goToStep(2)} />
      )}

      {step === 2 && (
        <VenueStep
          defaultValues={{
            venueName: draft.venueName,
            venueCity: draft.venueCity,
            venueState: draft.venueState,
            slots: draft.slots,
            timezone: draft.timezone,
          }}
          onBack={() => goToStep(1)}
          onNext={handleVenueSubmit}
        />
      )}

      {step === 3 && draft.movie && (
        <RoomStep
          defaultValues={{
            rows: draft.rows === '' ? undefined : draft.rows,
            seatsPerRow: draft.seatsPerRow === '' ? undefined : draft.seatsPerRow,
            priceInReais: draft.priceInReais === '' ? undefined : draft.priceInReais,
            format: draft.format,
            audio: draft.audio,
            roomType: draft.roomType,
            vipSurchargePercent: draft.vipSurchargePercent,
          }}
          movie={draft.movie}
          venueName={draft.venueName}
          venueCity={draft.venueCity}
          venueState={draft.venueState}
          startsAtUtcList={draft.slots.map((slot) => zonedWallTimeToUtcDate(slot.date, slot.time, draft.timezone))}
          timezone={draft.timezone}
          accessibleSeats={draft.accessibleSeats}
          onToggleAccessibleSeat={toggleAccessibleSeat}
          onBack={() => goToStep(2)}
          onSubmit={handleRoomSubmit}
          submitting={isSubmitting}
          submitError={submitError}
        />
      )}
    </div>
  )
}
