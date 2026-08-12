import { fileTypeFromBuffer } from 'file-type'
import { ulid } from 'ulid'

// SVG fica fora de propósito: é XML, pode carregar <script>, e o bucket é público
// servindo o content-type detectado -- aceitar SVG seria XSS armazenado direto (§5.3.4).
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

// Nunca confia na extensão do nome de arquivo nem no Content-Type declarado pelo
// cliente -- os dois são controlados por quem envia o upload. Só os primeiros bytes
// do arquivo (magic bytes) decidem o tipo real (§5.3.4). `file-type` não suporta SVG
// (é texto, não tem assinatura binária) -- SVG cai naturalmente no `undefined` abaixo,
// sem precisar de um caso especial.
export async function detectImageMime(buffer: Buffer): Promise<AllowedImageMime | undefined> {
  const detected = await fileTypeFromBuffer(buffer)
  if (!detected || !isAllowedImageMime(detected.mime)) return undefined
  return detected.mime
}

// Nome gerado no servidor -- nunca o nome enviado pelo cliente, que é onde entram path
// traversal e colisão (§5.3.4). Extensão vem do tipo detectado por magic bytes, não do
// nome original.
export function buildStorageKey(folder: string, mimeType: AllowedImageMime): string {
  return `${folder}/${ulid()}.${EXTENSION_BY_MIME[mimeType]}`
}
