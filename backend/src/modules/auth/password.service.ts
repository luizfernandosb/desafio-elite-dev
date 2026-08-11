import { randomBytes } from 'node:crypto'
import argon2 from 'argon2'

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id })
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password)
}

// hash de custo real, mas de senha nenhuma -- só para gastar o mesmo tempo de CPU
// quando não há hash de usuário contra o qual comparar (§7.1).
let dummyHashPromise: Promise<string> | undefined
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(randomBytes(32).toString('hex'))
  return dummyHashPromise
}

// Custo constante: "e-mail não existe" e "senha errada" precisam do mesmo tempo de
// resposta, senão o timing vira o oráculo que a mensagem idêntica escondeu. `hash` é
// `null` tanto para e-mail inexistente quanto para conta só-Google (sem senha).
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
