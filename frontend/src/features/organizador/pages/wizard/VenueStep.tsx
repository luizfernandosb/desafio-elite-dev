import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button, Input } from '../../../../components'
import { CityPicker } from '../../components/CityPicker'
import { StatePicker } from '../../components/StatePicker'
import { TimezonePicker } from '../../components/TimezonePicker'
import { venueStepSchema, type VenueStepValues } from '../../schemas'
import styles from './steps.module.css'

interface VenueStepProps {
  defaultValues: VenueStepValues
  onBack: () => void
  onNext: (values: VenueStepValues) => void
}

export function VenueStep({ defaultValues, onBack, onNext }: VenueStepProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<VenueStepValues>({
    resolver: zodResolver(venueStepSchema),
    defaultValues,
    mode: 'onBlur',
  })

  const date = watch('date')
  const time = watch('time')
  const timezone = watch('timezone')
  const venueState = watch('venueState')
  const venueCity = watch('venueCity')

  return (
    <form className={styles.step} onSubmit={handleSubmit(onNext)} noValidate>
      <h2>Onde e quando?</h2>
      <Input label="Local" error={errors.venueName?.message} {...register('venueName')} />
      <StatePicker
        value={venueState}
        onChange={(value) => {
          setValue('venueState', value, { shouldValidate: true })
          // cidade selecionada pertencia ao estado anterior -- não faz sentido sobrar
          setValue('venueCity', '', { shouldValidate: true })
        }}
        error={errors.venueState?.message}
      />
      <CityPicker
        uf={venueState}
        value={venueCity}
        onChange={(value) => setValue('venueCity', value, { shouldValidate: true })}
        error={errors.venueCity?.message}
      />
      <div className={styles.row}>
        {/* data e hora separadas -- um datetime-local só é ruim no celular (§ etapa 04) */}
        <Input label="Data" type="date" error={errors.date?.message} {...register('date')} />
        <Input label="Horário" type="time" error={errors.time?.message} {...register('time')} />
      </div>
      {/* Select do Radix não tem `register()` (sem <input> nativo por trás) -- valor
          escrito no form via `setValue`, mesmo padrão de qualquer campo controlado
          fora do DOM nativo (§ exploração da etapa 04, "Select ... via Controller ou
          onValueChange manual"). */}
      <TimezonePicker
        value={timezone}
        onChange={(value) => setValue('timezone', value, { shouldValidate: true })}
        date={date}
        time={time}
        error={errors.timezone?.message}
      />
      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={onBack}>
          Voltar
        </Button>
        <Button type="submit">Continuar</Button>
      </div>
    </form>
  )
}
