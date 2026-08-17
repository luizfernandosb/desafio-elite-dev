import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useToast } from '../../../components'
import {
  createEvent,
  organizadorKeys,
  publishEvent,
  type CatalogItem,
  type CreateEventInput,
  type OrganizerEvent,
} from '../api'
import { eventErrorMessage } from '../error-messages'
import type { RoomStepValues, SessionAttrsValues, SlotValues, VenueStepValues } from '../schemas'
import { zonedWallTimeToUtcDate } from '../timezones'
import { MovieStep } from './wizard/MovieStep'
import { RoomStep } from './wizard/RoomStep'
import { VenueStep } from './wizard/VenueStep'
import styles from './CreateEventWizard.module.css'

const DRAFT_KEY = 'organizador:novo-evento:rascunho'

interface WizardDraft {
  movie: CatalogItem | null
  venueName: string
  venueCity: string
  venueState: string
  slots: SlotValues[]
  timezone: string
  rows: number | ''
  seatsPerRow: number | ''
  priceInReais: number | ''
  accessibleSeats: string[]
  sessions: SessionAttrsValues[]
}

interface SlotAttempt {
  slot: SlotValues
  sessionAttrs: SessionAttrsValues
}

type SlotOutcome =
  | { kind: 'published'; event: OrganizerEvent }
  | { kind: 'not-created'; attempt: SlotAttempt; reason: unknown }
  | { kind: 'not-published'; event: OrganizerEvent; reason: unknown }

const DEFAULT_SESSION_ATTRS: SessionAttrsValues = {
  format: 'TWO_D',
  audio: 'DUBBED',
  roomType: 'STANDARD',
  vipSurchargePercent: undefined,
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
  sessions: [DEFAULT_SESSION_ATTRS],
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

function buildCreateInput(
  draft: WizardDraft,
  roomValues: RoomStepValues,
  slot: SlotValues,
  sessionAttrs: SessionAttrsValues,
): CreateEventInput {
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
    format: sessionAttrs.format,
    audio: sessionAttrs.audio,
    roomType: sessionAttrs.roomType,
    vipSurchargePercent: sessionAttrs.roomType === 'VIP' ? sessionAttrs.vipSurchargePercent : undefined,
    layout: {
      rows: roomValues.rows,
      seatsPerRow: roomValues.seatsPerRow,
      accessibleSeats: draft.accessibleSeats,
    },
  }
}

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
    setDraft((prev) => ({
      ...prev,
      ...values,
      sessions: values.slots.map((_, index) => prev.sessions[index] ?? DEFAULT_SESSION_ATTRS),
    }))
    goToStep(3)
  }

  async function handleRoomSubmit(values: RoomStepValues) {
    const nextDraft = {
      ...draft,
      rows: values.rows,
      seatsPerRow: values.seatsPerRow,
      priceInReais: values.priceInReais,
      sessions: values.sessions,
    }
    setDraft(nextDraft)

    if (!nextDraft.movie) {
      goToStep(1)
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    const attempts: SlotAttempt[] = nextDraft.slots.map((slot, index) => ({ slot, sessionAttrs: values.sessions[index]! }))

    const results: SlotOutcome[] = await Promise.all(
      attempts.map(async (attempt): Promise<SlotOutcome> => {
        let created: OrganizerEvent
        try {
          created = await createEvent(buildCreateInput(nextDraft, values, attempt.slot, attempt.sessionAttrs))
        } catch (reason) {
          return { kind: 'not-created', attempt, reason }
        }
        try {
          const published = await publishEvent(created.id)
          return { kind: 'published', event: published }
        } catch (reason) {
          return { kind: 'not-published', event: created, reason }
        }
      }),
    )

    setIsSubmitting(false)
    void queryClient.invalidateQueries({ queryKey: organizadorKeys.events() })

    const published = results.filter((result): result is Extract<SlotOutcome, { kind: 'published' }> =>
      result.kind === 'published',
    )
    const notCreated = results.filter((result): result is Extract<SlotOutcome, { kind: 'not-created' }> =>
      result.kind === 'not-created',
    )
    const notPublished = results.filter((result): result is Extract<SlotOutcome, { kind: 'not-published' }> =>
      result.kind === 'not-published',
    )

    if (notCreated.length === 0 && notPublished.length === 0) {
      sessionStorage.removeItem(DRAFT_KEY)
      showToast(published.length === 1 ? 'Sessão publicada.' : `${published.length} sessões publicadas.`, 'success')
      navigate(
        published.length === 1 ? `/organizador/eventos/${published[0]!.event.id}` : '/organizador?status=PUBLISHED',
        { replace: true },
      )
      return
    }

    setDraft((prev) => ({
      ...prev,
      slots: notCreated.map((result) => result.attempt.slot),
      sessions: notCreated.map((result) => result.attempt.sessionAttrs),
    }))

    const messages: string[] = []
    messages.push(
      published.length > 0
        ? `${published.length} de ${attempts.length} sessões publicadas.`
        : `Não foi possível publicar ${attempts.length === 1 ? 'a sessão' : 'as sessões'}.`,
    )
    if (notCreated.length > 0) {
      const reason = eventErrorMessage(notCreated[0]!.reason)
      messages.push(
        `${notCreated.length} ${notCreated.length === 1 ? 'não foi criada' : 'não foram criadas'}: ${reason} Corrija e tente de novo -- só ${notCreated.length === 1 ? 'esse horário continua' : 'esses horários continuam'} no formulário.`,
      )
    }
    if (notPublished.length > 0) {
      const reason = eventErrorMessage(notPublished[0]!.reason)
      messages.push(
        `${notPublished.length} ${notPublished.length === 1 ? 'foi criada, mas não publicada' : 'foram criadas, mas não publicadas'} (${reason}) -- publique manualmente em "Minhas sessões".`,
      )
    }
    setSubmitError(messages.join(' '))
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
            sessions: draft.slots.map((_, index) => draft.sessions[index] ?? DEFAULT_SESSION_ATTRS),
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
