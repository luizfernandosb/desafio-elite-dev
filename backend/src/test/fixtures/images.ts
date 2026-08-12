// Fixtures pequenas para os testes de upload de imagem (etapa 12). JPEG e WebP só
// precisam da assinatura de magic bytes que `file-type` de fato confere (bytes
// mínimos, não uma imagem íntegra); PNG exige uma estrutura de chunks válida (IHDR +
// IDAT), por isso vem de um base64 real de 1x1 pixel em vez de bytes à mão.

// FF D8 FF + marcador JFIF -- é só isso que `file-type` confere para JPEG.
export const JPEG_FIXTURE = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])

// PNG 1x1 real e válido (assinatura + IHDR + IDAT + IEND) -- `file-type` percorre os
// chunks à procura de IDAT, um PNG truncado na assinatura não seria detectado.
export const PNG_FIXTURE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

// "RIFF" + tamanho do chunk (irrelevante para a detecção) + "WEBP" -- é só isso que
// `file-type` confere para WebP.
export const WEBP_FIXTURE = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP'),
  Buffer.from('VP8 '),
])

// Texto puro renomeado para .png -- sem assinatura binária nenhuma, `file-type` retorna
// undefined.
export const TEXT_FIXTURE = Buffer.from('isto não é uma imagem de verdade, é só texto')

// SVG é XML -- `file-type` não tem detector para SVG (não suportado por design, sem
// assinatura binária confiável), então cai no mesmo `undefined` do texto puro.
export const SVG_FIXTURE = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')

// PDF renomeado para .png -- tem assinatura própria e É detectado (application/pdf),
// só não está na whitelist de imagem.
export const PDF_FIXTURE = Buffer.from('%PDF-1.4\n%fixture de teste, não é um PDF completo/válido')
