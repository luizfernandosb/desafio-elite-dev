import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetTestStores } from './msw/handlers/index'
import { server } from './msw/server'

// 'error': qualquer requisição sem handler quebra o teste -- não existe loopback para
// proteger aqui (diferente do back-end), então não há motivo para 'bypass'/'warn'.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  // pedidos/ingressos emitidos pelos handlers dinâmicos (orders.ts/tickets.ts)
  // são estado em memória do MÓDULO, não do MSW -- resetHandlers() não toca
  // nisso; sem isto, um ingresso emitido num teste vazaria para o próximo.
  resetTestStores()
})
afterAll(() => server.close())

// jsdom não implementa Pointer Events nem `scrollIntoView` -- sem isto, abrir o
// `<Select>` (Radix, § etapa 02) em qualquer teste lança "hasPointerCapture is not a
// function" antes mesmo de o primeiro teste que precisa disso existir (§ etapa 10,
// EventPicker/PortariaPage). Global aqui, não por arquivo de teste: qualquer tela
// futura que abra um Select herda o mesmo ambiente sem repetir o polyfill.
if (typeof Element !== 'undefined') {
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
}
