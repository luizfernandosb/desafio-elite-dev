import { defineConfig } from 'vitest/config'

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
          include: ['src/**/*.integration.test.ts', 'prisma/**/*.integration.test.ts'],
          environment: 'node',
          fileParallelism: false,
        },
      },
    ],
  },
})
