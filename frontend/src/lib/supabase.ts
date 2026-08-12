import { createClient } from '@supabase/supabase-js'
import { env } from './env'

// Cliente de LEITURA apenas -- nenhuma escrita pelo cliente Supabase (§4.4.2). Escrita
// sempre pela API; este cliente só assina `postgres_changes` em `seat_state` via
// Realtime (etapa 07 do plano de front). A anon key é pública por design: quem
// protege o que ela lê é a política de RLS no banco (etapa 11 do back-end), não o
// sigilo da chave -- por isso ela pode ir no bundle e a service_role key nunca pode.
export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
