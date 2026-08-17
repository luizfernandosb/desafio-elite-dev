import { useEffect, useState } from 'react'
import { getStoredTheme, setTheme, type Theme } from '../lib/theme'
import { Select } from './Select'

const OPTIONS: Array<{ value: Theme; label: string }> = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
]

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
