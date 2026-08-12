import { setupServer } from 'msw/node'
import { handlers } from './handlers'
import { storageHandlers } from './storage-handlers'

// listen/close ficam no `beforeAll`/`afterAll` de cada arquivo de teste que precisa
// -- nunca no test/setup.ts global. `onUnhandledRequest: 'error'` intercepta QUALQUER
// requisição HTTP do processo, inclusive as do supertest contra `app` em loopback;
// ativar isto globalmente quebraria todo teste de integração que não usa TMDb.
export const server = setupServer(...handlers, ...storageHandlers)
