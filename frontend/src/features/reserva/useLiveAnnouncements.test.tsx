import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isOwnSeatChange, useLiveAnnouncements } from './useLiveAnnouncements'

afterEach(() => {
  vi.useRealTimers()
})

describe('isOwnSeatChange', () => {
  it('assento presente na lista de "meus assentos" (selecionados + em hold) é próprio', () => {
    expect(isOwnSeatChange('seat-1', ['seat-1', 'seat-2'])).toBe(true)
    expect(isOwnSeatChange('seat-3', ['seat-1', 'seat-2'])).toBe(false)
    expect(isOwnSeatChange('seat-1', [])).toBe(false)
  })
})

describe('useLiveAnnouncements', () => {
  it('um único assento -- anúncio individual, no singular', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useLiveAnnouncements())

    act(() => result.current.announce({ seatId: 's1', label: 'F12', status: 'SOLD' }))
    act(() => vi.advanceTimersByTime(800))

    expect(result.current.announcement).toBe('Assento F12 foi vendido')
  })

  it('vários assentos com o mesmo status no mesmo tick -- um anúncio agregado, não um por assento', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useLiveAnnouncements())

    act(() => {
      result.current.announce({ seatId: 's1', label: 'F12', status: 'SOLD' })
      result.current.announce({ seatId: 's2', label: 'F13', status: 'SOLD' })
      result.current.announce({ seatId: 's3', label: 'F14', status: 'SOLD' })
    })
    act(() => vi.advanceTimersByTime(800))

    expect(result.current.announcement).toBe('3 assentos foram vendidos')
  })

  it('status diferentes agregados no mesmo tick -- mensagem genérica, ainda uma só', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useLiveAnnouncements())

    act(() => {
      result.current.announce({ seatId: 's1', label: 'F12', status: 'SOLD' })
      result.current.announce({ seatId: 's2', label: 'F13', status: 'FREE' })
    })
    act(() => vi.advanceTimersByTime(800))

    expect(result.current.announcement).toBe('2 assentos mudaram de status')
  })

  it('duas rajadas separadas no tempo -- dois anúncios distintos, não misturados', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useLiveAnnouncements())

    act(() => result.current.announce({ seatId: 's1', label: 'F12', status: 'HELD' }))
    act(() => vi.advanceTimersByTime(800))
    expect(result.current.announcement).toBe('Assento F12 foi reservado')

    act(() => result.current.announce({ seatId: 's2', label: 'F13', status: 'FREE' }))
    act(() => vi.advanceTimersByTime(800))
    expect(result.current.announcement).toBe('Assento F13 foi liberado')
  })
})
