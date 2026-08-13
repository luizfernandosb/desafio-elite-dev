import { describe, expect, it } from 'vitest'
import { contrastRatio, hexToRgb, mixOverBackground } from './contrast'

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

describe('mixOverBackground', () => {
  it('0% -- devolve o fundo intacto', () => {
    expect(mixOverBackground('#ff0000', '#ffffff', 0)).toBe('#ffffff')
  })

  it('100% -- devolve o primeiro plano intacto', () => {
    expect(mixOverBackground('#ff0000', '#ffffff', 100)).toBe('#ff0000')
  })

  it('50% entre preto e branco -- cinza médio', () => {
    expect(mixOverBackground('#000000', '#ffffff', 50)).toBe('#808080')
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
  surface1: '#f4f6f8',
  surface2: '#e9ecf0',
  border: '#88909c',
  successText: '#096829',
  warningText: '#8a4e00',
  dangerText: '#b71c1c',
  neutralGateText: '#5f5f64',
}

const DARK = {
  textPrimary: '#e8eaed',
  textSecondary: '#9aa1ac',
  surface0: '#14161a',
  surface1: '#1c1f24',
  surface2: '#262a31',
  border: '#666d7a',
  // no escuro os tokens `-text` apontam de volta pro vívido (tokens.css) -- o
  // vívido já mede bem sobre o próprio tint com um fundo escuro atrás, EXCETO
  // --danger (mede só 4.18:1 sobre --surface-1 escuro) -- ganha um vermelho mais
  // claro só para texto
  successText: '#1db954',
  warningText: '#ff9500',
  dangerText: '#ff6b60',
  neutralGateText: '#8e8e93',
}

// tokens vívidos (fundo do tint, cor de fundo de dot/badge) -- não mudam por tema
const SUCCESS = '#1db954'
const WARNING = '#ff9500'
const DANGER = '#ff3b30'

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

// § etapa 12 -- auditoria encontrou os três primeiros abaixo com o token VÍVIDO como
// texto, medindo ~1.9-3:1 (docs/bugs.md). Corrigido com os tokens `-text`
// (tokens.css); estes testes travam o build se alguém voltar a usar o vívido cru
// como cor de texto em cima do próprio tint.
describe('badge de status (Badge.tsx) -- texto `-text` sobre o tint do próprio vívido', () => {
  const CASES = [
    { name: 'success', vivid: SUCCESS, percent: 14, light: LIGHT.successText, dark: DARK.successText },
    { name: 'warning', vivid: WARNING, percent: 16, light: LIGHT.warningText, dark: DARK.warningText },
    { name: 'danger', vivid: DANGER, percent: 12, light: LIGHT.dangerText, dark: DARK.dangerText },
  ]

  for (const { name, vivid, percent, light, dark } of CASES) {
    it(`${name}: tema claro, sobre surface-0 e surface-1 (Card) ≥ 4.5:1`, () => {
      expect(contrastRatio(light, mixOverBackground(vivid, LIGHT.surface0, percent))).toBeGreaterThanOrEqual(AA_TEXT)
      expect(contrastRatio(light, mixOverBackground(vivid, LIGHT.surface1, percent))).toBeGreaterThanOrEqual(AA_TEXT)
    })

    it(`${name}: tema escuro, sobre surface-0 e surface-1 (Card) ≥ 4.5:1`, () => {
      expect(contrastRatio(dark, mixOverBackground(vivid, DARK.surface0, percent))).toBeGreaterThanOrEqual(AA_TEXT)
      expect(contrastRatio(dark, mixOverBackground(vivid, DARK.surface1, percent))).toBeGreaterThanOrEqual(AA_TEXT)
    })
  }
})

describe('feed da portaria (GateStats.tsx) -- dot `-text` sobre surface-2', () => {
  it.each([
    ['success', LIGHT.successText, DARK.successText],
    ['warning', LIGHT.warningText, DARK.warningText],
    ['danger', LIGHT.dangerText, DARK.dangerText],
    ['neutral', LIGHT.neutralGateText, DARK.neutralGateText],
  ] as const)('%s ≥ 3:1 (ícone redundante com forma, não único sinal) nos dois temas', (_name, light, dark) => {
    expect(contrastRatio(light, LIGHT.surface2)).toBeGreaterThanOrEqual(AA_NON_TEXT)
    expect(contrastRatio(dark, DARK.surface2)).toBeGreaterThanOrEqual(AA_NON_TEXT)
  })
})

// Os quatro blocos de resultado da portaria (ValidationResultScreen.module.css) --
// literais fixos, iguais nos dois temas de propósito (§ etapa 10/12: legibilidade a
// 2 metros sob luz variável, não acompanha claro/escuro do SO). "Não o mínimo
// exato" (plano da etapa 12) -- todos medem bem acima de 4.5:1.
describe('resultado da portaria (ValidationResultScreen.module.css) -- blocos fixos', () => {
  it.each([
    ['valid', '#0a7a35', '#e6f9ee'],
    ['invalid', '#cc1b1b', '#fff0f0'],
    ['used', '#995700', '#fff4e5'],
    ['neutral', '#555555', '#f0f0f0'],
  ])('%s: texto sobre fundo ≥ 4.5:1', (_name, text, background) => {
    expect(contrastRatio(text, background)).toBeGreaterThanOrEqual(AA_TEXT)
  })
})

describe('OfflineBanner.module.css -- texto fixo sobre --warning nos dois temas', () => {
  it('#14161a sobre #ff9500 ≥ 4.5:1', () => {
    expect(contrastRatio('#14161a', '#ff9500')).toBeGreaterThanOrEqual(AA_TEXT)
  })
})
