import { defineConfig } from 'vitest/config'

// carrega .env.test antes de resolver a config -- os workers de teste herdam
// esse process.env, então isto precisa rodar antes de qualquer import de
// código da aplicação (que valida env na primeira importação de config/env.ts)
process.loadEnvFile('.env.test')

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.unit.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration',
          include: ['src/**/*.integration.test.ts'],
          environment: 'node',
          // integração roda em série -- evita conflito de dados entre testes
          fileParallelism: false,
        },
      },
    ],
  },
})
