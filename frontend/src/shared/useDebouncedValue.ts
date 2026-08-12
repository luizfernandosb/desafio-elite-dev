import { useEffect, useState } from 'react'

// Sem lib de debounce nova -- nenhuma está instalada, e o hook é pequeno o bastante
// para não justificar uma dependência (mesmo raciocínio de money.ts e date.ts).
// Movido para shared/ na etapa 05: primeiro em features/organizador (busca no TMDb,
// 400ms), reaproveitado por features/catalog (busca pública, mesmo 400ms) -- um
// segundo consumidor é o sinal de que o hook não é mais específico de uma feature.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
