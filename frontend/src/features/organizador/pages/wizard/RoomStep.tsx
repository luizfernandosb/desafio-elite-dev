import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button, Input, Select, SeatMap, type SeatMapRow } from '../../../../components'
import { formatEventDate } from '../../../../shared/date'
import { formatMoney } from '../../../../shared/money'
import { AUDIO_OPTIONS, FORMAT_OPTIONS, ROOM_TYPE_OPTIONS, sessionAttributeBadges } from '../../../../shared/session-attributes'
import type { CatalogItem } from '../../api'
import { MAX_ROWS, MAX_SEATS_PER_ROW } from '../../room-layout'
import { roomStepSchema, type RoomStepValues, type SessionAttrsValues } from '../../schemas'
import styles from './steps.module.css'

interface RoomStepProps {
  defaultValues: Partial<RoomStepValues>
  movie: CatalogItem
  venueName: string
  venueCity: string
  venueState: string
  // um item por horário do passo anterior -- "Publicar sessão" cria E publica uma
  // sessão por data/hora desta lista, todas com o mesmo filme/local/sala física/
  // preço-base (§ etapa "múltiplos horários", CreateEventWizard.tsx); formato/
  // áudio/sala variam por horário, ver `defaultValues.sessions`
  startsAtUtcList: Date[]
  timezone: string
  accessibleSeats: string[]
  onToggleAccessibleSeat: (label: string) => void
  onBack: () => void
  onSubmit: (values: RoomStepValues) => void
  submitting: boolean
  submitError?: string | null
}

// Prévia do mapa ao vivo (§ etapa 04, passo 3) -- gera só os rótulos ("A1", "A2", ...)
// a partir do layout ainda sendo digitado; não existe seat de verdade até o POST.
function buildDesignRows(rows: number, seatsPerRow: number, accessibleSeats: string[]): SeatMapRow[] {
  const accessibleSet = new Set(accessibleSeats)
  const result: SeatMapRow[] = []
  for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
    const rowLetter = String.fromCharCode(65 + rowIndex)
    const seats = Array.from({ length: seatsPerRow }, (_, index) => {
      const label = `${rowLetter}${index + 1}`
      return { label, accessible: accessibleSet.has(label) }
    })
    result.push({ row: rowLetter, seats })
  }
  return result
}

// preço-base é um só pro lote (mesma sala física); o efetivo por horário só muda
// quando AQUELE horário específico é Sala VIP -- dois horários da mesma sessão podem
// ter preços finais diferentes (um padrão, outro VIP com acréscimo)
function effectivePriceInCents(basePriceInCents: number, session: SessionAttrsValues): number {
  return session.roomType === 'VIP' && session.vipSurchargePercent
    ? Math.round(basePriceInCents * (1 + session.vipSurchargePercent / 100))
    : basePriceInCents
}

export function RoomStep({
  defaultValues,
  movie,
  venueName,
  venueCity,
  venueState,
  startsAtUtcList,
  timezone,
  accessibleSeats,
  onToggleAccessibleSeat,
  onBack,
  onSubmit,
  submitting,
  submitError,
}: RoomStepProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RoomStepValues>({
    resolver: zodResolver(roomStepSchema),
    defaultValues,
    mode: 'onBlur',
  })

  // `valueAsNumber` (register abaixo) já entrega `number` -- campo vazio vira `NaN`,
  // nunca `undefined`, por isso o `Number.isFinite` (não `??`) para tratar como 0.
  const rawRows = watch('rows')
  const rawSeatsPerRow = watch('seatsPerRow')
  const rawPriceInReais = watch('priceInReais')
  const rowsValue = Number.isFinite(rawRows) ? rawRows : 0
  const seatsPerRowValue = Number.isFinite(rawSeatsPerRow) ? rawSeatsPerRow : 0
  const priceInReaisValue = Number.isFinite(rawPriceInReais) ? rawPriceInReais : 0
  const totalSeats = rowsValue > 0 && seatsPerRowValue > 0 ? rowsValue * seatsPerRowValue : 0
  const basePriceInCents = Math.round(priceInReaisValue * 100)
  const sessions = watch('sessions') ?? []
  const sessionCount = startsAtUtcList.length

  const previewRows =
    rowsValue > 0 && seatsPerRowValue > 0
      ? buildDesignRows(
          Math.min(rowsValue, MAX_ROWS),
          Math.min(seatsPerRowValue, MAX_SEATS_PER_ROW),
          accessibleSeats,
        )
      : []

  const totalPotentialRevenue = startsAtUtcList.reduce((total, _startsAtUtc, index) => {
    const session = sessions[index]
    if (!session) return total
    return total + effectivePriceInCents(basePriceInCents, session) * totalSeats
  }, 0)

  return (
    <form className={styles.step} onSubmit={handleSubmit(onSubmit)} noValidate>
      <h2>Sala e preço</h2>
      {submitError && (
        <p role="alert" className={styles.formError}>
          {submitError}
        </p>
      )}
      <div className={styles.row}>
        <Input
          label="Fileiras"
          type="number"
          min={1}
          max={MAX_ROWS}
          error={errors.rows?.message}
          {...register('rows', { valueAsNumber: true })}
        />
        <Input
          label="Assentos por fileira"
          type="number"
          min={1}
          max={MAX_SEATS_PER_ROW}
          error={errors.seatsPerRow?.message}
          {...register('seatsPerRow', { valueAsNumber: true })}
        />
      </div>
      <p className={styles.total}>{totalSeats} assentos</p>

      {previewRows.length > 0 && (
        <SeatMap rows={previewRows} onSeatClick={onToggleAccessibleSeat} legend />
      )}

      <Input
        label="Preço (R$)"
        type="number"
        min={0}
        step="0.01"
        hint="Valor em reais - enviado ao servidor em centavos (§4.6.1)"
        error={errors.priceInReais?.message}
        {...register('priceInReais', { valueAsNumber: true })}
      />

      <div className={styles.sessions}>
        {startsAtUtcList.map((startsAtUtc, index) => {
          const roomType = watch(`sessions.${index}.roomType`)
          const isVip = roomType === 'VIP'
          return (
            <div key={index} className={styles.sessionCard}>
              <h3>{sessionCount === 1 ? 'Formato e sala' : formatEventDate(startsAtUtc, timezone)}</h3>
              <div className={styles.row}>
                <Select
                  label="Formato"
                  options={FORMAT_OPTIONS}
                  value={watch(`sessions.${index}.format`)}
                  onValueChange={(value) =>
                    setValue(`sessions.${index}.format`, value as RoomStepValues['sessions'][number]['format'], {
                      shouldValidate: true,
                    })
                  }
                  error={errors.sessions?.[index]?.format?.message}
                />
                <Select
                  label="Áudio"
                  options={AUDIO_OPTIONS}
                  value={watch(`sessions.${index}.audio`)}
                  onValueChange={(value) =>
                    setValue(`sessions.${index}.audio`, value as RoomStepValues['sessions'][number]['audio'], {
                      shouldValidate: true,
                    })
                  }
                  error={errors.sessions?.[index]?.audio?.message}
                />
              </div>

              <Select
                label="Sala"
                options={ROOM_TYPE_OPTIONS}
                value={roomType}
                onValueChange={(value) => {
                  const nextRoomType = value as RoomStepValues['sessions'][number]['roomType']
                  setValue(`sessions.${index}.roomType`, nextRoomType, { shouldValidate: true, shouldDirty: true })
                  if (nextRoomType !== 'VIP') {
                    setValue(`sessions.${index}.vipSurchargePercent`, undefined, { shouldValidate: true })
                  }
                }}
                error={errors.sessions?.[index]?.roomType?.message}
              />

              {isVip && (
                <Input
                  label="Porcentagem adicional da Sala VIP (%)"
                  type="number"
                  min={1}
                  max={300}
                  hint="Somada ao preço normal só para este horário -- ex.: 20 vira preço x 1,20"
                  error={errors.sessions?.[index]?.vipSurchargePercent?.message}
                  {...register(`sessions.${index}.vipSurchargePercent`, { valueAsNumber: true })}
                />
              )}
            </div>
          )
        })}
      </div>

      <div className={styles.summary}>
        <h3>Resumo</h3>
        <dl>
          <div>
            <dt>Filme</dt>
            <dd>{movie.title}</dd>
          </div>
          <div>
            <dt>Local</dt>
            <dd>
              {venueName}, {venueCity} - {venueState}
            </dd>
          </div>
          <div>
            <dt>{sessionCount === 1 ? 'Sessão' : `Horários (${sessionCount})`}</dt>
            <dd>
              {startsAtUtcList.map((startsAtUtc, index) => {
                const session = sessions[index]
                return (
                  <div key={index}>
                    {formatEventDate(startsAtUtc, timezone)}
                    {session && (
                      <>
                        {' - '}
                        {sessionAttributeBadges(session).join(' - ')}
                        {' - '}
                        {formatMoney(effectivePriceInCents(basePriceInCents, session))}
                      </>
                    )}
                  </div>
                )
              })}
            </dd>
          </div>
          <div>
            <dt>Capacidade</dt>
            <dd>{totalSeats} assentos</dd>
          </div>
          <div>
            <dt>Receita potencial{sessionCount > 1 ? ' (todas as sessões)' : ''}</dt>
            <dd>{formatMoney(totalPotentialRevenue)}</dd>
          </div>
        </dl>
      </div>

      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={onBack}>
          Voltar
        </Button>
        <Button type="submit" loading={submitting}>
          {sessionCount === 1 ? 'Publicar sessão' : `Publicar ${sessionCount} sessões`}
        </Button>
      </div>
    </form>
  )
}
