import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button, Input, SeatMap, type SeatMapRow } from '../../../../components'
import { formatEventDate } from '../../../../shared/date'
import { formatMoney } from '../../../../shared/money'
import type { CatalogItem } from '../../api'
import { MAX_ROWS, MAX_SEATS_PER_ROW } from '../../room-layout'
import { roomStepSchema, type RoomStepValues } from '../../schemas'
import styles from './steps.module.css'

interface RoomStepProps {
  defaultValues: Partial<RoomStepValues>
  movie: CatalogItem
  venueName: string
  venueCity: string
  venueState: string
  startsAtUtc: Date
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

export function RoomStep({
  defaultValues,
  movie,
  venueName,
  venueCity,
  venueState,
  startsAtUtc,
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
  const priceInCents = Math.round(priceInReaisValue * 100)

  const previewRows =
    rowsValue > 0 && seatsPerRowValue > 0
      ? buildDesignRows(
          Math.min(rowsValue, MAX_ROWS),
          Math.min(seatsPerRowValue, MAX_SEATS_PER_ROW),
          accessibleSeats,
        )
      : []

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
            <dt>Data</dt>
            <dd>{formatEventDate(startsAtUtc, timezone)}</dd>
          </div>
          <div>
            <dt>Capacidade</dt>
            <dd>{totalSeats} assentos</dd>
          </div>
          <div>
            <dt>Preço</dt>
            <dd>{formatMoney(priceInCents)}</dd>
          </div>
          <div>
            <dt>Receita potencial</dt>
            <dd>{formatMoney(priceInCents * totalSeats)}</dd>
          </div>
        </dl>
      </div>

      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={onBack}>
          Voltar
        </Button>
        <Button type="submit" loading={submitting}>
          Criar sessão
        </Button>
      </div>
    </form>
  )
}
