export const JPEG_FIXTURE = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])

export const PNG_FIXTURE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

export const WEBP_FIXTURE = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP'),
  Buffer.from('VP8 '),
])

export const TEXT_FIXTURE = Buffer.from('isto não é uma imagem de verdade, é só texto')

export const SVG_FIXTURE = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')

export const PDF_FIXTURE = Buffer.from('%PDF-1.4\n%fixture de teste, não é um PDF completo/válido')
