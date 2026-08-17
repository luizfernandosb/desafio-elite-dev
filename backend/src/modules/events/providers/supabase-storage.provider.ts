import { StorageClient } from '@supabase/storage-js'
import { env } from '../../../config/env'
import { buildStorageKey, type AllowedImageMime } from './image-mime'
import type { StorageProvider } from './storage-provider'

const BUCKET = 'event-images'

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
