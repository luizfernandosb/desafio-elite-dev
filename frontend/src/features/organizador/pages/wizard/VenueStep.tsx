import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { Button, Input } from '../../../../components'
import { CityPicker } from '../../components/CityPicker'
import { StatePicker } from '../../components/StatePicker'
import { TimezonePicker } from '../../components/TimezonePicker'
import { MAX_SLOTS, venueStepSchema, type VenueStepValues } from '../../schemas'
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
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<VenueStepValues>({
    resolver: zodResolver(venueStepSchema),
    defaultValues,
    mode: 'onBlur',
  })

  // Primeiro uso de `useFieldArray` no projeto -- não há um padrão prévio de "lista
  // de campos repetível" pra espelhar aqui, mas o resto (zodResolver, setValue pros
  // pickers controlados) segue exatamente a mesma convenção do resto do formulário.
  const { fields, append, remove } = useFieldArray({ control, name: 'slots' })

  const timezone = watch('timezone')
  const venueState = watch('venueState')
  const venueCity = watch('venueCity')
  // fuso é um só pro lote inteiro -- a confirmação mostra o primeiro horário como
  // representante (§ "Sessão às... no horário de..."), não um resumo por linha
  const firstSlot = watch('slots.0')

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

      <div className={styles.slots}>
        <p className={styles.slotsLabel}>Horários (uma sessão por horário)</p>
        {fields.map((field, index) => (
          <div key={field.id} className={styles.slotRow}>
            {/* data e hora separadas -- um datetime-local só é ruim no celular (§ etapa 04) */}
            <Input
              label="Data"
              type="date"
              error={errors.slots?.[index]?.date?.message}
              {...register(`slots.${index}.date`)}
            />
            <Input
              label="Horário"
              type="time"
              error={errors.slots?.[index]?.time?.message}
              {...register(`slots.${index}.time`)}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => remove(index)}
              disabled={fields.length <= 1}
              aria-label={`Remover horário ${index + 1}`}
            >
              Remover
            </Button>
          </div>
        ))}
        {errors.slots?.root?.message && (
          <p role="alert" className={styles.formError}>
            {errors.slots.root.message}
          </p>
        )}
        <Button
          type="button"
          variant="secondary"
          onClick={() => append({ date: '', time: '' })}
          disabled={fields.length >= MAX_SLOTS}
        >
          Adicionar outro horário
        </Button>
      </div>

      {/* Select do Radix não tem `register()` (sem <input> nativo por trás) -- valor
          escrito no form via `setValue`, mesmo padrão de qualquer campo controlado
          fora do DOM nativo (§ exploração da etapa 04, "Select ... via Controller ou
          onValueChange manual"). */}
      <TimezonePicker
        value={timezone}
        onChange={(value) => setValue('timezone', value, { shouldValidate: true })}
        date={firstSlot?.date ?? ''}
        time={firstSlot?.time ?? ''}
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
