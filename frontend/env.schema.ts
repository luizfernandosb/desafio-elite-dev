import { z } from 'zod'

// Schema puro, sem `.parse()` -- importado tanto por src/lib/env.ts (roda no browser,
// valida `import.meta.env`) quanto por vite.config.ts (roda no Node durante o build,
// valida o resultado de `loadEnv()`). Um só lugar de verdade para o formato; dois
// lugares que o aplicam, em dois momentos diferentes (§ ver comentário em
// vite.config.ts sobre por que o segundo existe).
//
// Vive na raiz do projeto, fora de src/, de propósito: tsconfig.app.json (o browser)
// e tsconfig.node.json (vite.config.ts) são dois projetos TS com module/moduleResolution
// diferentes -- importar entre eles exigiria project references (composite + references
// nos dois lados) só para compartilhar 15 linhas de zod. Um arquivo incluído nos dois
// `include` é mais simples que a plumbing de referenced projects para este caso.
export const envSchema = z.object({
  VITE_API_URL: z.string().url(),
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(20),
  VITE_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  VITE_GOOGLE_CLIENT_ID: z.string().min(10),
  VITE_USE_MSW: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
})
