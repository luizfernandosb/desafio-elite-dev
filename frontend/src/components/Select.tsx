import { useId } from 'react'
import * as RadixSelect from '@radix-ui/react-select'
import styles from './Select.module.css'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  label: string
  options: SelectOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  error?: string
  name?: string
  disabled?: boolean
}

// Radix entra sem estilo -- o comportamento (listbox por teclado, foco preso,
// posicionamento) é dele; a aparência é nossa, sobre os mesmos tokens do Input
// (§ etapa 02, "Radix apenas como primitiva sem estilo").
export function Select({
  label,
  options,
  value,
  onValueChange,
  placeholder = 'Selecione',
  error,
  name,
  disabled,
}: SelectProps) {
  const id = useId()

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <RadixSelect.Root value={value} onValueChange={onValueChange} name={name} disabled={disabled}>
        <RadixSelect.Trigger
          id={id}
          className={[styles.trigger, error && styles.triggerError].filter(Boolean).join(' ')}
          aria-invalid={Boolean(error) || undefined}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon className={styles.icon} aria-hidden="true">
            ▾
          </RadixSelect.Icon>
        </RadixSelect.Trigger>
        <RadixSelect.Portal>
          <RadixSelect.Content className={styles.content} position="popper" sideOffset={4}>
            <RadixSelect.Viewport className={styles.viewport}>
              {options.map((option) => (
                <RadixSelect.Item key={option.value} value={option.value} className={styles.item}>
                  <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator className={styles.indicator} aria-hidden="true">
                    ✓
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
