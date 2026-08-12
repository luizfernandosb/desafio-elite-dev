import { describe, expect, it } from 'vitest'
import { formatMoney } from './money'

// ` ` explícito, não um espaço comum: `Intl.NumberFormat('pt-BR', { style:
// 'currency' })` separa o símbolo do valor com espaço SEM QUEBRA (U+00A0), não
// U+0020 -- um `'R$ 180,00'` digitado à mão no editor tem a aparência certa e falha
// por byte, não por lógica. Escrever o escape deixa a diferença visível no código.
describe('formatMoney', () => {
  it('formata centavos como reais', () => {
    expect(formatMoney(18000)).toBe('R$ 180,00')
  })

  it('zero centavos', () => {
    expect(formatMoney(0)).toBe('R$ 0,00')
  })

  it('arredonda para duas casas mesmo com valor ímpar de centavos', () => {
    expect(formatMoney(5)).toBe('R$ 0,05')
  })

  it('aceita outra moeda', () => {
    expect(formatMoney(10000, 'USD')).toBe('US$ 100,00')
  })
})
