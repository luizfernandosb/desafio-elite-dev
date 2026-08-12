import { describe, expect, it } from 'vitest'
import { maskUrl } from './request-logger.middleware'

describe('maskUrl', () => {
  it('mascara o shareToken no path da rota pública de compartilhamento', () => {
    expect(maskUrl('/api/v1/share/AbCd1234-_XyZ')).toBe('/api/v1/share/:token')
  })

  it('preserva query string irrelevante depois do token', () => {
    expect(maskUrl('/api/v1/share/token123?foo=bar')).toBe('/api/v1/share/:token?foo=bar')
  })

  it('não altera outras rotas', () => {
    expect(maskUrl('/api/v1/events/event-1/seatmap')).toBe('/api/v1/events/event-1/seatmap')
    expect(maskUrl('/health')).toBe('/health')
  })
})
