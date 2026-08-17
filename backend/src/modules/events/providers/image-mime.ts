import { fileTypeFromBuffer } from 'file-type'
import { ulid } from 'ulid'

export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME_TYPES)[number]

const EXTENSION_BY_MIME: Record<AllowedImageMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function isAllowedImageMime(mime: string): mime is AllowedImageMime {
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mime)
}

export async function detectImageMime(buffer: Buffer): Promise<AllowedImageMime | undefined> {
  const detected = await fileTypeFromBuffer(buffer)
  if (!detected || !isAllowedImageMime(detected.mime)) return undefined
  return detected.mime
}

export function buildStorageKey(folder: string, mimeType: AllowedImageMime): string {
  return `${folder}/${ulid()}.${EXTENSION_BY_MIME[mimeType]}`
}
