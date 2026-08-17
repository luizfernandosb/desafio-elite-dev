import { describe, expect, it } from 'vitest'
import { RoomType, TicketPriceType } from '../../../generated/prisma/enums'
import { computeEffectivePriceInCents, computeSeatPriceInCents } from './pricing'

describe('computeEffectivePriceInCents', () => {
  it('sala STANDARD -- preço efetivo é o preço base, sem adicional', () => {
    expect(
      computeEffectivePriceInCents({ priceInCents: 5000, roomType: RoomType.STANDARD, vipSurchargePercent: null }),
    ).toBe(5000)
  })

  it('sala VIP -- preço efetivo soma o adicional percentual', () => {
    expect(
      computeEffectivePriceInCents({ priceInCents: 5000, roomType: RoomType.VIP, vipSurchargePercent: 20 }),
    ).toBe(6000)
  })

  it('sala VIP sem vipSurchargePercent -- cai para o preço base (dado inconsistente, nunca deveria acontecer)', () => {
    expect(computeEffectivePriceInCents({ priceInCents: 5000, roomType: RoomType.VIP, vipSurchargePercent: null })).toBe(
      5000,
    )
  })
})

describe('computeSeatPriceInCents', () => {
  it('FULL -- cobra o preço efetivo cheio', () => {
    expect(computeSeatPriceInCents(6000, TicketPriceType.FULL)).toBe(6000)
  })

  it('HALF -- cobra metade do preço efetivo, arredondado', () => {
    expect(computeSeatPriceInCents(6000, TicketPriceType.HALF)).toBe(3000)
  })

  it('HALF com preço efetivo ímpar -- arredonda ao centavo mais próximo', () => {
    expect(computeSeatPriceInCents(2501, TicketPriceType.HALF)).toBe(1251)
  })
})
