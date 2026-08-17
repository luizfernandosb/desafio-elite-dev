import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import type { ZodIssue } from 'zod'
import { envSchema } from './env.schema.ts'

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

export default defineConfig({
  plugins: [react(), validateEnv()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
