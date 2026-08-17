import { useState, type FormEvent } from 'react'
import { Button, Input } from '../../../components'
import styles from './ManualEntry.module.css'

interface ManualEntryProps {
  disabled: boolean
  onSubmit: (code: string) => void
}

export function ManualEntry({ disabled, onSubmit }: ManualEntryProps) {
  const [value, setValue] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const code = value.trim()
    if (!code) return
    onSubmit(code)
    setValue('')
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <Input
        label="Código do ingresso"
        placeholder="Cole ou digite o código"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled}
      />
      <Button type="submit" disabled={disabled || !value.trim()}>
        Validar
      </Button>
    </form>
  )
}
