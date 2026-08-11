// O CLI do Prisma 7 não carrega .env automaticamente -- só o processo Node faz
// isso (via --env-file), então este arquivo carrega o próprio .env para os
// comandos `migrate`/`db push`/`studio`. O runtime da aplicação (lib/prisma.ts)
// não depende deste arquivo -- usa um driver adapter com a env já validada.
import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // migrate precisa de conexão de sessão -- o pooler 6543 não suporta migrations (§5.3.1)
  datasource: {
    url: process.env.DIRECT_URL,
  },
})
