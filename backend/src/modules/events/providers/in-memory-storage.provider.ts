import { buildStorageKey, type AllowedImageMime } from './image-mime'
import type { StorageProvider } from './storage-provider'

// Testes unitários do Service -- sem rede, sem Supabase (§5.3.4). Mesma geração de key
// da implementação real (ulid + extensão do tipo detectado), então o teste consegue
// asserir sobre o formato do resultado sem depender de mock de HTTP.
export class InMemoryStorageProvider implements StorageProvider {
  readonly files = new Map<string, { buffer: Buffer; mimeType: string }>()

  async upload(input: { buffer: Buffer; mimeType: string; folder: string }): Promise<{ url: string; key: string }> {
    const key = buildStorageKey(input.folder, input.mimeType as AllowedImageMime)
    this.files.set(key, { buffer: input.buffer, mimeType: input.mimeType })
    return { url: `memory://${key}`, key }
  }

  async remove(key: string): Promise<void> {
    this.files.delete(key)
  }
}
