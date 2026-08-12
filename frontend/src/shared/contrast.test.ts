import { describe, expect, it } from 'vitest'
import { contrastRatio, hexToRgb } from './contrast'

describe('contrastRatio', () => {
  it('preto sobre branco -- contraste máximo (21:1)', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })

  it('mesma cor -- contraste mínimo (1:1)', () => {
    expect(contrastRatio('#0097ff', '#0097ff')).toBeCloseTo(1, 5)
  })

  it('não importa a ordem dos argumentos', () => {
    expect(contrastRatio('#14161a', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#14161a'), 5)
  })
})

describe('hexToRgb', () => {
  it('hex de 6 dígitos', () => {
    expect(hexToRgb('#0097ff')).toEqual([0, 151, 255])
  })

  it('hex de 3 dígitos', () => {
    expect(hexToRgb('#fff')).toEqual([255, 255, 255])
  })
})

// Valores literais, não `getComputedStyle` -- de propósito (§ etapa 02, "sem
// browser"). Espelham tokens.css; se um token mudar de cor, este teste precisa ser
// atualizado a mão -- é o preço de rodar sem DOM, e o comentário existe para que
// quem mudar o token saiba que precisa vir aqui também.
const LIGHT = {
  textPrimary: '#14161a',
  textSecondary: '#5b6270',
  surface0: '#ffffff',
  border: '#88909c',
}

const DARK = {
  textPrimary: '#e8eaed',
  textSecondary: '#9aa1ac',
  surface0: '#14161a',
  border: '#666d7a',
}

const AA_TEXT = 4.5 // WCAG AA, texto normal
const AA_NON_TEXT = 3 // WCAG 1.4.11, borda/contorno de componente

describe('pares de token -- contraste mínimo dos dois temas (§5.1.1, critério de aceite)', () => {
  it('tema claro: texto primário sobre surface-0 ≥ 4.5:1', () => {
    expect(contrastRatio(LIGHT.textPrimary, LIGHT.surface0)).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it('tema claro: texto secundário sobre surface-0 ≥ 4.5:1', () => {
    expect(contrastRatio(LIGHT.textSecondary, LIGHT.surface0)).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it('tema claro: borda sobre surface-0 ≥ 3:1', () => {
    expect(contrastRatio(LIGHT.border, LIGHT.surface0)).toBeGreaterThanOrEqual(AA_NON_TEXT)
  })

  it('tema escuro: texto primário sobre surface-0 ≥ 4.5:1', () => {
    expect(contrastRatio(DARK.textPrimary, DARK.surface0)).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it('tema escuro: texto secundário sobre surface-0 ≥ 4.5:1', () => {
    expect(contrastRatio(DARK.textSecondary, DARK.surface0)).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it('tema escuro: borda sobre surface-0 ≥ 3:1', () => {
    expect(contrastRatio(DARK.border, DARK.surface0)).toBeGreaterThanOrEqual(AA_NON_TEXT)
  })
})
