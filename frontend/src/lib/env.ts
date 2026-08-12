import { envSchema } from '../../env.schema'

// Mesma disciplina do back-end (backend/src/config/env.ts): `import.meta.env` só
// aparece aqui. Qualquer variável sem o prefixo VITE_ nunca chega ao bundle -- é assim
// que SUPABASE_SERVICE_ROLE, STRIPE_SECRET_KEY e TMDB_API_KEY nunca vazam para o
// cliente: elas simplesmente não existem neste objeto (§5.3.5).
//
// Isto valida em runtime, no browser -- útil em dev (erro claro no console/tela no
// primeiro import), mas não impede um `vite build` de gerar um bundle quebrado: o
// build não executa este módulo, só o empacota. A validação que falha o BUILD em si
// mora em vite.config.ts, contra o mesmo `envSchema`.
export const env = envSchema.parse(import.meta.env)
