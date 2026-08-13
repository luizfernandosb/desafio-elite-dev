import { useState, type FormEvent } from 'react'
import { Button, Input } from '../../../components'
import styles from './ManualEntry.module.css'

interface ManualEntryProps {
  disabled: boolean
  onSubmit: (code: string) => void
}

// Caminho de primeira classe, não fallback de câmera (FE-7, § etapa 10) -- sempre
// visível abaixo do leitor, nunca atrás de um "não tenho câmera". `Enter` já valida
// (submit do <form>), sem precisar de handler de teclado separado para o botão.
export function ManualEntry({ disabled, onSubmit }: ManualEntryProps) {
  const [value, setValue] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // aceita colado com espaços/quebras de linha (comum ao copiar de um print) --
    // `trim` antes de enviar, nunca o texto cru do campo
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
