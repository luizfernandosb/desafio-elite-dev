import { setupServer } from 'msw/node'
import { handlers } from './handlers/index'

// Para o Vitest (Node) -- listen/close ficam no setup global de teste
// (src/test/setup.ts), diferente do back-end, porque aqui toda a suíte de front bate
// só em rede mockada (nenhum teste de front fala com um Postgres real).
export const server = setupServer(...handlers)
