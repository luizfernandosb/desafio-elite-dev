import { StorageClient } from '@supabase/storage-js'
import { env } from '../../../config/env'
import { buildStorageKey, type AllowedImageMime } from './image-mime'
import type { StorageProvider } from './storage-provider'

// Banner de evento é conteúdo público -- URL pública evita renovar signed URL a cada
// item da listagem (§5.3.4). Bucket criado manualmente no painel do Supabase.
const BUCKET = 'event-images'

// `@supabase/storage-js` isolado, não o `@supabase/supabase-js` completo: só usamos
// Storage aqui, e o cliente completo inicializa Realtime/Auth/Functions de bootstrap
// (Realtime exige WebSocket nativo, só disponível a partir do Node 22 -- este processo
// não precisa de nenhum dos dois). Documentado pelo próprio pacote como o caminho para
// "bundle-sensitive environments".
//
// service_role key só existe aqui, no back-end -- ela ignora RLS e equivale a acesso
// total ao banco (§5.3.5). Upload direto do browser exigiria expor esta chave ou emitir
// URL assinada; nenhuma das duas se paga para um banner público.
const client = new StorageClient(`${env.SUPABASE_URL}/storage/v1`, {
  apikey: env.SUPABASE_SERVICE_ROLE,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
})

export class SupabaseStorageProvider implements StorageProvider {
  async upload(input: { buffer: Buffer; mimeType: string; folder: string }): Promise<{ url: string; key: string }> {
    const key = buildStorageKey(input.folder, input.mimeType as AllowedImageMime)

    const { error } = await client.from(BUCKET).upload(key, input.buffer, {
      contentType: input.mimeType,
      upsert: false,
    })
    if (error) throw error

    const {
      data: { publicUrl },
    } = client.from(BUCKET).getPublicUrl(key)

    return { url: publicUrl, key }
  }

  async remove(key: string): Promise<void> {
    const { error } = await client.from(BUCKET).remove([key])
    if (error) throw error
  }
}
