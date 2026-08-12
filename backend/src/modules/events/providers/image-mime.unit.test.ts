import { describe, expect, it } from 'vitest'
import {
  JPEG_FIXTURE,
  PDF_FIXTURE,
  PNG_FIXTURE,
  SVG_FIXTURE,
  TEXT_FIXTURE,
  WEBP_FIXTURE,
} from '../../../test/fixtures/images'
import { buildStorageKey, detectImageMime } from './image-mime'

describe('detectImageMime -- magic bytes, não extensão nem Content-Type (§5.3.4)', () => {
  it('JPEG real -- aceito', async () => {
    expect(await detectImageMime(JPEG_FIXTURE)).toBe('image/jpeg')
  })

  it('PNG real -- aceito', async () => {
    expect(await detectImageMime(PNG_FIXTURE)).toBe('image/png')
  })

  it('WebP real -- aceito', async () => {
    expect(await detectImageMime(WEBP_FIXTURE)).toBe('image/webp')
  })

  it('texto puro renomeado -- rejeitado (undefined)', async () => {
    expect(await detectImageMime(TEXT_FIXTURE)).toBeUndefined()
  })

  it('SVG -- rejeitado (undefined), whitelist não inclui XML', async () => {
    expect(await detectImageMime(SVG_FIXTURE)).toBeUndefined()
  })

  it('PDF renomeado para .png -- detectado como application/pdf, fora da whitelist', async () => {
    expect(await detectImageMime(PDF_FIXTURE)).toBeUndefined()
  })
})

describe('buildStorageKey -- nome gerado no servidor (§5.3.4)', () => {
  it('extensão vem do tipo detectado, nunca de entrada externa', () => {
    expect(buildStorageKey('events/evt-1', 'image/jpeg')).toMatch(/^events\/evt-1\/[0-9A-Z]{26}\.jpg$/)
    expect(buildStorageKey('events/evt-1', 'image/png')).toMatch(/^events\/evt-1\/[0-9A-Z]{26}\.png$/)
    expect(buildStorageKey('events/evt-1', 'image/webp')).toMatch(/^events\/evt-1\/[0-9A-Z]{26}\.webp$/)
  })

  it('duas chamadas geram keys diferentes -- sem colisão previsível', () => {
    const a = buildStorageKey('events/evt-1', 'image/jpeg')
    const b = buildStorageKey('events/evt-1', 'image/jpeg')
    expect(a).not.toBe(b)
  })
})
