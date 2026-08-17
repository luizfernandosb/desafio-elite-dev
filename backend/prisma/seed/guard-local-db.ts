import 'dotenv/config'

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? ''
const host = (() => {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
})()

if (host !== 'localhost' && host !== '127.0.0.1') {
  console.error(
    `seed:reset abortado -- DIRECT_URL aponta para "${host || '(vazio)'}", não para o Postgres local.\n` +
      `"prisma migrate reset" apaga o schema "public" inteiro; contra o Supabase isso alcança ` +
      `schemas gerenciados (auth, storage, realtime) que não são nossos para apagar (§5.3.2).\n` +
      `Só roda contra localhost/127.0.0.1 (docker compose up -d db).`,
  )
  process.exit(1)
}
