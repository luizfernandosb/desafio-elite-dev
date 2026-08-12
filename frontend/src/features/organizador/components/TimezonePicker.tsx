import { Select } from '../../../components'
import { BRAZIL_TIMEZONES, describeLocalTime } from '../timezones'
import styles from './TimezonePicker.module.css'

interface TimezonePickerProps {
  value: string
  onChange: (value: string) => void
  date: string
  time: string
  error?: string
  disabled?: boolean
}

// Seletor de fuso obrigatório, default América/São Paulo (§ etapa 04, passo 2) --
// o default de verdade fica no `defaultValues` do `useForm` do passo, não aqui.
export function TimezonePicker({ value, onChange, date, time, error, disabled }: TimezonePickerProps) {
  let confirmation: string | null = null
  if (date && time && value) {
    try {
      confirmation = describeLocalTime(date, time, value)
    } catch {
      confirmation = null
    }
  }

  return (
    <div className={styles.wrapper}>
      <Select
        label="Fuso horário"
        options={BRAZIL_TIMEZONES}
        value={value}
        onValueChange={onChange}
        error={error}
        disabled={disabled}
      />
      {confirmation && (
        <p className={styles.confirmation} role="status">
          {confirmation}
        </p>
      )}
    </div>
  )
}
