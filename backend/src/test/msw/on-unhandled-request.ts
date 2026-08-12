import type { UnhandledRequestCallback } from 'msw'

// `'bypass'` puro deixaria passar QUALQUER chamada sem handler, inclusive uma acidental
// para uma API externa de verdade -- exatamente o que a etapa 14 (§7.10.7) pede para
// nunca acontecer em silêncio. `'error'` puro quebra o loopback do supertest contra a
// própria `app` (não tem handler, não é uma chamada externa, mas MSW não distingue os
// dois sob essa strategy -- ver docs/bugs.md #5). Este callback faz a distinção que as
// duas strategies simples não fazem: loopback passa; qualquer outro host sem handler
// registrado derruba o teste.
export const bypassLoopbackOnly: UnhandledRequestCallback = (request, print) => {
  const { hostname } = new URL(request.url)
  if (hostname === '127.0.0.1' || hostname === 'localhost') return
  print.error()
}
