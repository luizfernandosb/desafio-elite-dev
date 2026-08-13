import { useState } from 'react'

// Gerada uma vez por sessão de checkout, nunca a cada re-render (§ etapa 08) --
// `useState` com inicializador preguiçoso só roda no PRIMEIRO render do componente
// que chama este hook; StrictMode (main.tsx) até chega a rodar o inicializador duas
// vezes na montagem, mas o VALOR final guardado no state é o mesmo em ambas as
// chamadas -- não é o resultado de uma delas "vazando" pra outra, é só como
// `useState` funciona. Sem isso, a idempotência do back (`Idempotency-Key` no
// header) não serviria pra nada -- um duplo clique geraria uma chave nova a cada
// vez, e o back veria dois pedidos "diferentes".
export function useIdempotencyKey(): string {
  const [key] = useState(() => crypto.randomUUID())
  return key
}
