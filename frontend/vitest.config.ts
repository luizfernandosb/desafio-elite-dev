import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// mergeConfig sobre o vite.config.ts real -- evita duplicar o alias @/ (e qualquer
// plugin) num segundo lugar que pode desalinhar do primeiro.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: true,
    },
  }),
)
