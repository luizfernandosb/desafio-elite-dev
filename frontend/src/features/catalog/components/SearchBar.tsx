import { useEffect, useRef, useState } from 'react'
import { Input } from '../../../components'
import { useDebouncedValue } from '../../../shared/useDebouncedValue'

interface SearchBarProps {
  value: string
  onCommit: (value: string) => void
}

const DEBOUNCE_MS = 400

export function SearchBar({ value, onCommit }: SearchBarProps) {
  const [draft, setDraft] = useState(value)
  const debounced = useDebouncedValue(draft, DEBOUNCE_MS)
  const lastCommitted = useRef(value)

  useEffect(() => {
    if (debounced !== lastCommitted.current) {
      lastCommitted.current = debounced
      onCommit(debounced.trim())
    }
  }, [debounced, onCommit])

  useEffect(() => {
    setDraft(value)
    lastCommitted.current = value
  }, [value])

  return (
    <Input
      label="Buscar sessão"
      placeholder="Ex.: Duna"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
    />
  )
}
