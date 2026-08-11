import { execSync } from 'node:child_process'
import { beforeAll } from 'vitest'

beforeAll(() => {
  // sem a opção `env` -- execSync já herda as variáveis do processo atual
  execSync('npx prisma migrate deploy', { stdio: 'inherit' })
})
