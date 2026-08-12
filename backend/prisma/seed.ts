// Orquestra o cenário de demonstração (etapa 13, §6). Roda via `npm run seed`
// (`prisma db seed`) ou `npm run seed:reset` (reset local + seed). `import 'dotenv/config'`
// aqui é defensivo: o Prisma CLI já carrega o .env em `prisma.config.ts` e herda esse
// `process.env` para este subprocesso, mas o corpo do seed (`./seed/run.ts`) também
// roda direto via `tsx` no teste de integração, que não passa por aquele config.
import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { readDemoSummary } from './seed/demo-summary'
import { runSeed } from './seed/run'
import { SEED_PASSWORD } from './seed/users.seed'

async function main() {
  const { users, events } = await runSeed(prisma)
  const demo = await readDemoSummary(prisma, events.eventA.id)

  console.log('\n=== Seed concluído ===')
  console.log(`\nCredenciais (senha igual para todos): ${SEED_PASSWORD}`)
  console.log(`  Organizador : ${users.organizer.email}`)
  console.log(`  Cliente 1   : ${users.customer1.email}`)
  console.log(`  Cliente 2   : ${users.customer2.email}`)
  console.log(`  Portaria    : ${users.gate.email}`)

  console.log('\nEventos:')
  console.log(`  A -- Duna: Parte Dois (PUBLISHED, com vendas)   : ${events.eventA.id}`)
  console.log(`  B -- Oppenheimer (PUBLISHED, todo livre)        : ${events.eventB.id}`)
  console.log(`  C -- Pobres Criaturas (DRAFT, só do organizador): ${events.eventC.id}`)

  console.log('\nPortaria -- os quatro retornos da FE-6, prontos para escanear no evento A:')
  console.log(`  VALID             -- assento ${demo.activeSeat}\n    ${demo.activeCode}`)
  console.log(`  ALREADY_USED      -- validado há ~1h por "${users.gate.email}"\n    ${demo.usedCode}`)
  console.log(`  WRONG_EVENT       -- qualquer código acima, escaneado no posto do evento B (${events.eventB.id})`)
  console.log('  INVALID_SIGNATURE -- qualquer código acima, com 1 caractere adulterado à mão')

  console.log(`\nLink de compartilhamento já ativo: ${demo.shareUrl}\n`)
}

main()
  .catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
