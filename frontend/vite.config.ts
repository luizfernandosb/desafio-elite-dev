import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import type { ZodIssue } from 'zod'
import { envSchema } from './env.schema.ts'

// `vite build` não executa lib/env.ts -- só empacota. Sem isto, um `.env` incompleto
// vira um bundle que só quebra quando alguém abre a página em produção (§ etapa 01,
// critério de aceite "variável faltando → build falha com o nome do campo"). O hook
// `config` de um plugin roda para dev/build/preview/vitest igual, com o `mode`
// correto de cada um -- por isso a checagem mora num plugin, não dentro do próprio
// `defineConfig(...)` como callback (isso mudaria a forma do export de objeto para
// função, e o `vitest.config.ts` faz `mergeConfig` esperando um objeto).
function validateEnv(): Plugin {
  return {
    name: 'validate-env',
    config(_config, { mode }) {
      const parsed = envSchema.safeParse(loadEnv(mode, process.cwd(), 'VITE_'))
      if (!parsed.success) {
        const envFile = mode === 'development' ? '.env' : `.env.${mode}`
        const issues = parsed.error.issues
          .map((issue: ZodIssue) => `  - ${issue.path.join('.')}: ${issue.message}`)
          .join('\n')
        throw new Error(`Variável de ambiente inválida ou faltando (${envFile}):\n${issues}`)
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), validateEnv()],
  resolve: {
    // espelha "paths" de tsconfig.app.json -- os dois precisam apontar pro mesmo lugar
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
