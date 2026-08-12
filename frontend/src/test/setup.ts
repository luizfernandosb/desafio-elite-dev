import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './msw/server'

// 'error': qualquer requisição sem handler quebra o teste -- não existe loopback para
// proteger aqui (diferente do back-end), então não há motivo para 'bypass'/'warn'.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
