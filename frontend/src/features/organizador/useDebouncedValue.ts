import { useEffect, useState } from 'react'

// Sem lib de debounce nova -- nenhuma está instalada, e o hook é pequeno o bastante
// para não justificar uma dependência (mesmo raciocínio de shared/money.ts e
// shared/date.ts). 400ms é o valor do plano (§ etapa 04, busca no TMDb).
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
