import { describe, expect, it } from 'vitest'
import { formatMoney } from './money'

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
