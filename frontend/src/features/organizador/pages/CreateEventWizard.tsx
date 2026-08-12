import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useToast } from '../../../components'
import { createEvent, organizadorKeys, type CatalogItem, type CreateEventInput } from '../api'
import { eventErrorMessage } from '../error-messages'
import type { RoomStepValues, VenueStepValues } from '../schemas'
import { zonedWallTimeToUtcDate } from '../timezones'
import { MovieStep } from './wizard/MovieStep'
import { RoomStep } from './wizard/RoomStep'
import { VenueStep } from './wizard/VenueStep'
import styles from './CreateEventWizard.module.css'

// Chave única de rascunho -- um organizador só cria uma sessão de cada vez (não há
// suporte a múltiplos rascunhos concorrentes, e o plano só pede sobreviver a um F5
// acidental, não abas paralelas).
const DRAFT_KEY = 'organizador:novo-evento:rascunho'

interface WizardDraft {
  movie: CatalogItem | null
  venueName: string
  venueCity: string
  date: string
  time: string
  timezone: string
  // '' até o passo 3 ser preenchido pela primeira vez -- os inputs usam
  // `valueAsNumber` (RoomStep.tsx), então um valor de verdade já chega como number.
  rows: number | ''
  seatsPerRow: number | ''
  priceInReais: number | ''
  accessibleSeats: string[]
}

const EMPTY_DRAFT: WizardDraft = {
  movie: null,
  venueName: '',
  venueCity: '',
  date: '',
  time: '',
  timezone: 'America/Sao_Paulo',
  rows: '',
  seatsPerRow: '',
  priceInReais: '',
  accessibleSeats: [],
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

// Assistente de criação em três passos (§ etapa 04): um formulário único com todos
// os campos é onde o organizador desiste. Estado na URL (`?passo=`) -- voltar no
// navegador funciona, recarregar não perde o passo; rascunho em sessionStorage (não é
// dado sensível) sobrevive a um F5 acidental. Só o passo 3 dispara `POST /events` --
// criar no passo 1 encheria o painel de rascunhos abandonados.
export default function CreateEventWizard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const step = clampStep(searchParams.get('passo'))
  const [draft, setDraft] = useState<WizardDraft>(loadDraft)
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

  const {
    mutateAsync: submitEvent,
    isPending,
    error: submitErrorRaw,
  } = useMutation({
    mutationFn: (input: CreateEventInput) => createEvent(input),
    onSuccess: (event) => {
      sessionStorage.removeItem(DRAFT_KEY)
      void queryClient.invalidateQueries({ queryKey: organizadorKeys.events() })
      showToast('Sessão criada como rascunho.', 'success')
      navigate(`/organizador/eventos/${event.id}`, { replace: true })
    },
  })

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
    setDraft((prev) => ({ ...prev, rows: values.rows, seatsPerRow: values.seatsPerRow, priceInReais: values.priceInReais }))

    if (!draft.movie) {
      goToStep(1)
      return
    }

    const startsAt = zonedWallTimeToUtcDate(draft.date, draft.time, draft.timezone)
    const input: CreateEventInput = {
      source: draft.movie.source,
      externalId: draft.movie.externalId,
      venueName: draft.venueName,
      venueCity: draft.venueCity,
      startsAt: startsAt.toISOString(),
      timezone: draft.timezone,
      priceInCents: Math.round(values.priceInReais * 100),
      layout: {
        rows: values.rows,
        seatsPerRow: values.seatsPerRow,
        accessibleSeats: draft.accessibleSeats,
      },
    }

    await submitEvent(input)
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
            date: draft.date,
            time: draft.time,
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
          }}
          movie={draft.movie}
          venueName={draft.venueName}
          venueCity={draft.venueCity}
          startsAtUtc={zonedWallTimeToUtcDate(draft.date, draft.time, draft.timezone)}
          timezone={draft.timezone}
          accessibleSeats={draft.accessibleSeats}
          onToggleAccessibleSeat={toggleAccessibleSeat}
          onBack={() => goToStep(2)}
          onSubmit={handleRoomSubmit}
          submitting={isPending}
          submitError={submitErrorRaw ? eventErrorMessage(submitErrorRaw) : null}
        />
      )}
    </div>
  )
}
