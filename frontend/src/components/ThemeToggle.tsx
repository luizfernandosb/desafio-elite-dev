import { useEffect, useState } from 'react'
import { getStoredTheme, setTheme, type Theme } from '../lib/theme'
import { Select } from './Select'

const OPTIONS: Array<{ value: Theme; label: string }> = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
]

// Não é um dos 12 componentes base -- é a UI da alternância manual de tema que a
// etapa exige (§5.1.1: "portaria costuma operar em ambiente escuro; forçar o tema do
// SO seria hostil"), construída sobre o Select já existente.
export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>('system')

  useEffect(() => {
    setThemeState(getStoredTheme())
  }, [])

  function handleChange(value: string) {
    const next = value as Theme
    setThemeState(next)
    setTheme(next)
  }

  return (
    <Select
      label="Tema"
      value={theme}
      onValueChange={handleChange}
      options={OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
    />
  )
}
