import { describe, expect, it } from 'vitest'
import { computeSeatPriceInCents } from './pricing'

describe('computeSeatPriceInCents', () => {
  it('FULL -- cobra o preço efetivo cheio', () => {
    expect(computeSeatPriceInCents(6000, 'FULL')).toBe(6000)
  })

  it('HALF -- cobra metade do preço efetivo, arredondado', () => {
    expect(computeSeatPriceInCents(6000, 'HALF')).toBe(3000)
  })

  it('HALF com preço efetivo ímpar -- arredonda ao centavo mais próximo', () => {
    expect(computeSeatPriceInCents(2501, 'HALF')).toBe(1251) // 1250.5 -> 1251
  })
})
