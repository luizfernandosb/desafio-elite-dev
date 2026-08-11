import { Prisma } from '../../generated/prisma/client'

export function isUniqueViolation(
  err: unknown,
): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}
