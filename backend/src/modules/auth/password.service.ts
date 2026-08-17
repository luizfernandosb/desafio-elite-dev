import { randomBytes } from 'node:crypto'
import argon2 from 'argon2'

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id })
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password)
}

let dummyHashPromise: Promise<string> | undefined
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(randomBytes(32).toString('hex'))
  return dummyHashPromise
}

export async function verifyPasswordConstantTime(
  hash: string | null,
  password: string,
): Promise<boolean> {
  if (!hash) {
    await verifyPassword(await getDummyHash(), password)
    return false
  }
  return verifyPassword(hash, password)
}
