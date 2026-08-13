import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Select, Textarea, useToast } from '../../../components'
import { AUDIO_OPTIONS, FORMAT_OPTIONS, ROOM_TYPE_OPTIONS } from '../../../shared/session-attributes'
import { organizadorKeys, updateEvent, type OrganizerEvent, type UpdateEventInput } from '../api'
import { CityPicker } from '../components/CityPicker'
import { StatePicker } from '../components/StatePicker'
import { TimezonePicker } from '../components/TimezonePicker'
import { eventErrorMessage } from '../error-messages'
import { editEventSchema, type EditEventValues } from '../schemas'
import { zonedWallTimeToUtcDate } from '../timezones'
import styles from './EventEditForm.module.css'

interface EventEditFormProps {
  event: OrganizerEvent
}

// yyyy-mm-dd / HH:mm no fuso do EVENTO, não no fuso do navegador (§4.6.3) --
// `Intl.DateTimeFormat` com partes separadas, nunca `toISOString` (sempre UTC) nem
// `getHours()`/`getDate()` (sempre o fuso da MÁQUINA que roda o código).
function toDateInputValue(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso))
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}`
}

function toTimeInputValue(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.hour}:${map.minute}`
}

// Campos bloqueados após a primeira venda (SALE_LOCKED_FIELDS no back,
// events.service.ts) -- `venueName` e `synopsis` ficam de fora de propósito: não
// alteram o contrato de compra, continuam editáveis mesmo com ingressos vendidos.
export function EventEditForm({ event }: EventEditFormProps) {
  const hasSales = event._count.tickets > 0
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<EditEventValues>({
    resolver: zodResolver(editEventSchema),
    mode: 'onBlur',
    defaultValues: {
      venueName: event.venueName,
      venueState: event.venueState,
      venueCity: event.venueCity,
      synopsis: event.synopsis ?? '',
      date: toDateInputValue(event.startsAt, event.timezone),
      time: toTimeInputValue(event.startsAt, event.timezone),
      timezone: event.timezone,
      priceInReais: event.priceInCents / 100,
      format: event.format,
      audio: event.audio,
      roomType: event.roomType,
      vipSurchargePercent: event.vipSurchargePercent ?? undefined,
    },
  })

  const {
    mutateAsync,
    isPending,
    error: submitError,
  } = useMutation({
    mutationFn: (input: UpdateEventInput) => updateEvent(event.id, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(organizadorKeys.eventDetail(event.id), updated)
      void queryClient.invalidateQueries({ queryKey: organizadorKeys.events() })
      showToast('Sessão atualizada.', 'success')
    },
  })

  async function onSubmit(values: EditEventValues) {
    // a UI só desabilita os campos bloqueados -- não confia só nisso: o payload
    // enviado nem inclui esses campos quando `hasSales`, então um 409 do servidor
    // (defesa em profundidade) nunca chega a acontecer no caminho feliz
    const input: UpdateEventInput = {
      venueName: values.venueName,
      synopsis: values.synopsis,
    }
    if (!hasSales) {
      input.venueCity = values.venueCity
      input.venueState = values.venueState
      input.startsAt = zonedWallTimeToUtcDate(values.date, values.time, values.timezone).toISOString()
      input.timezone = values.timezone
      input.priceInCents = Math.round(values.priceInReais * 100)
      input.format = values.format
      input.audio = values.audio
      input.roomType = values.roomType
      input.vipSurchargePercent = values.roomType === 'VIP' ? values.vipSurchargePercent : null
    }
    await mutateAsync(input)
  }

  const date = watch('date')
  const time = watch('time')
  const timezone = watch('timezone')
  const venueState = watch('venueState')
  const venueCity = watch('venueCity')
  const roomType = watch('roomType')
  const isVip = roomType === 'VIP'
  const lockedHint = 'Bloqueado: há ingressos vendidos para esta sessão'

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <h2>Editar sessão</h2>
      {submitError && (
        <p role="alert" className={styles.formError}>
          {eventErrorMessage(submitError)}
        </p>
      )}
      {hasSales && (
        <p className={styles.notice} role="status">
          Esta sessão já vendeu ingressos - cidade, data, horário, fuso e preço não podem mais mudar.
        </p>
      )}

      <Input label="Local" error={errors.venueName?.message} {...register('venueName')} />
      <StatePicker
        value={venueState}
        onChange={(value) => {
          setValue('venueState', value, { shouldValidate: true, shouldDirty: true })
          setValue('venueCity', '', { shouldValidate: true, shouldDirty: true })
        }}
        error={errors.venueState?.message}
        disabled={hasSales}
      />
      <CityPicker
        uf={venueState}
        value={venueCity}
        onChange={(value) => setValue('venueCity', value, { shouldValidate: true, shouldDirty: true })}
        error={errors.venueCity?.message}
        disabled={hasSales}
      />
      <Textarea label="Sinopse" error={errors.synopsis?.message} {...register('synopsis')} />

      <div className={styles.row}>
        <Input
          label="Data"
          type="date"
          disabled={hasSales}
          hint={hasSales ? lockedHint : undefined}
          error={errors.date?.message}
          {...register('date')}
        />
        <Input label="Horário" type="time" disabled={hasSales} error={errors.time?.message} {...register('time')} />
      </div>

      <TimezonePicker
        value={timezone}
        onChange={(value) => setValue('timezone', value, { shouldValidate: true, shouldDirty: true })}
        date={date}
        time={time}
        error={errors.timezone?.message}
        disabled={hasSales}
      />

      <Input
        label="Preço (R$)"
        type="number"
        min={0}
        step="0.01"
        disabled={hasSales}
        hint={hasSales ? lockedHint : 'Valor em reais - enviado ao servidor em centavos'}
        error={errors.priceInReais?.message}
        {...register('priceInReais', { valueAsNumber: true })}
      />

      <div className={styles.row}>
        <Select
          label="Formato"
          options={FORMAT_OPTIONS}
          value={watch('format')}
          onValueChange={(value) =>
            setValue('format', value as EditEventValues['format'], { shouldValidate: true, shouldDirty: true })
          }
          error={errors.format?.message}
          disabled={hasSales}
        />
        <Select
          label="Áudio"
          options={AUDIO_OPTIONS}
          value={watch('audio')}
          onValueChange={(value) =>
            setValue('audio', value as EditEventValues['audio'], { shouldValidate: true, shouldDirty: true })
          }
          error={errors.audio?.message}
          disabled={hasSales}
        />
      </div>

      <Select
        label="Sala"
        options={ROOM_TYPE_OPTIONS}
        value={roomType}
        onValueChange={(value) => {
          const nextRoomType = value as EditEventValues['roomType']
          setValue('roomType', nextRoomType, { shouldValidate: true, shouldDirty: true })
          if (nextRoomType !== 'VIP') {
            setValue('vipSurchargePercent', undefined, { shouldValidate: true, shouldDirty: true })
          }
        }}
        error={errors.roomType?.message}
        disabled={hasSales}
      />

      {isVip && (
        <Input
          label="Porcentagem adicional da Sala VIP (%)"
          type="number"
          min={1}
          max={300}
          disabled={hasSales}
          hint={hasSales ? lockedHint : 'Somada ao preço normal só para esta sessão'}
          error={errors.vipSurchargePercent?.message}
          {...register('vipSurchargePercent', { valueAsNumber: true })}
        />
      )}

      <div className={styles.actions}>
        <Button type="submit" loading={isPending} disabled={!isDirty}>
          Salvar alterações
        </Button>
      </div>
    </form>
  )
}
