import type { UnhandledRequestCallback } from 'msw'

export const bypassLoopbackOnly: UnhandledRequestCallback = (request, print) => {
  const { hostname } = new URL(request.url)
  if (hostname === '127.0.0.1' || hostname === 'localhost') return
  print.error()
}
