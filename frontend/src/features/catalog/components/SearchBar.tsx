import { useEffect, useRef, useState } from 'react'
import { Input } from '../../../components'
import { useDebouncedValue } from '../../../shared/useDebouncedValue'

interface SearchBarProps {
  value: string // valor já commitado (espelha `?q=` na URL, dono é o CatalogPage)
  onCommit: (value: string) => void
}

const DEBOUNCE_MS = 400 // mesmo valor da busca no TMDb (organizador) -- consistência de sensação entre buscas

// Debounce de 400ms antes de refletir na URL: digitar rápido não deve empilhar uma
// entrada de histórico por tecla, nem disparar uma requisição por tecla.
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

  // `value` muda por fora (ex.: botão "limpar filtros", F5 com `?q=` na URL) --
  // sincroniza o campo sem esperar o usuário digitar de novo.
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
