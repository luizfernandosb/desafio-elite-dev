import { setupWorker } from 'msw/browser'
import { handlers } from './handlers/index'

// Só para desenvolvimento (VITE_USE_MSW=true, ver lib/env.ts) -- iniciado em main.tsx
// antes do primeiro render. Nunca entra num build de produção: nenhum import deste
// módulo fora de um `if (env.VITE_USE_MSW)`, então o bundler não tem motivo para
// incluir o worker do MSW no `dist/` final.
export const worker = setupWorker(...handlers)
