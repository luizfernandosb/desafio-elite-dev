export interface StorageProvider {
  upload(input: { buffer: Buffer; mimeType: string; folder: string }): Promise<{ url: string; key: string }>
  remove(key: string): Promise<void>
}
