import { buildStorageKey, type AllowedImageMime } from './image-mime'
import type { StorageProvider } from './storage-provider'

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
