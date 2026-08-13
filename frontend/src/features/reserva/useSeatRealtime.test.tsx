import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSeatRealtime } from './useSeatRealtime'

interface PostgresChangesPayload {
  new: Record<string, unknown>
}

let onCallback: ((payload: PostgresChangesPayload) => void) | undefined
let subscribeCallback: ((status: string) => void) | undefined
const removeChannelSpy = vi.fn()
const mockChannel = {
  on: vi.fn((_event: string, _filter: unknown, callback: (payload: PostgresChangesPayload) => void) => {
    onCallback = callback
    return mockChannel
  }),
  subscribe: vi.fn((callback: (status: string) => void) => {
    subscribeCallback = callback
    return mockChannel
  }),
}
const channelSpy = vi.fn((_name: string) => mockChannel)

vi.mock('../../lib/supabase', () => ({
  supabase: {
    channel: (name: string) => channelSpy(name),
    removeChannel: (channel: unknown) => removeChannelSpy(channel),
  },
}))

describe('useSeatRealtime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    onCallback = undefined
    subscribeCallback = undefined
  })

  it('assina o canal e o filtro certos para o evento', () => {
    renderHook(() => useSeatRealtime('evt-1', vi.fn()))

    expect(channelSpy).toHaveBeenCalledWith('seatmap:evt-1')
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'seat_state', filter: 'eventId=eq.evt-1' },
      expect.any(Function),
    )
  })

  it('patch de um assento chama onPatch só com aquele assento', () => {
    const onPatch = vi.fn()
    renderHook(() => useSeatRealtime('evt-1', onPatch))

    onCallback?.({ new: { seatId: 'seat-1', eventId: 'evt-1', status: 'HELD', expiresAt: '2026-01-01T00:10:00.000Z' } })

    expect(onPatch).toHaveBeenCalledWith({
      seatId: 'seat-1',
      eventId: 'evt-1',
      status: 'HELD',
      expiresAt: '2026-01-01T00:10:00.000Z',
    })
  })

  it('começa em CONNECTING e reflete SUBSCRIBED assim que o canal confirma', () => {
    const { result } = renderHook(() => useSeatRealtime('evt-1', vi.fn()))
    expect(result.current).toBe('CONNECTING')

    act(() => subscribeCallback?.('SUBSCRIBED'))
    expect(result.current).toBe('SUBSCRIBED')
  })

  it('CHANNEL_ERROR/TIMED_OUT muda connectionStatus (é o gatilho do fallback de polling)', () => {
    const { result } = renderHook(() => useSeatRealtime('evt-1', vi.fn()))

    act(() => subscribeCallback?.('CHANNEL_ERROR'))
    expect(result.current).toBe('CHANNEL_ERROR')

    act(() => subscribeCallback?.('TIMED_OUT'))
    expect(result.current).toBe('TIMED_OUT')
  })

  it('desmontar remove o canal', () => {
    const { unmount } = renderHook(() => useSeatRealtime('evt-1', vi.fn()))
    unmount()
    expect(removeChannelSpy).toHaveBeenCalledTimes(1)
  })

  it('evento sem seatId (DELETE, na prática nunca ocorre em seat_state) é ignorado sem quebrar', () => {
    const onPatch = vi.fn()
    renderHook(() => useSeatRealtime('evt-1', onPatch))

    onCallback?.({ new: {} })

    expect(onPatch).not.toHaveBeenCalled()
  })
})
