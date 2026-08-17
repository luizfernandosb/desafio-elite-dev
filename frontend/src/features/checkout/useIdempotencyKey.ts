import { useState } from 'react'

export function useIdempotencyKey(): string {
  const [key] = useState(() => crypto.randomUUID())
  return key
}
