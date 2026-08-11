import type { NextFunction, Request, Response } from 'express'
import type { ZodType } from 'zod'
import { ValidationError } from '../shared/errors'

interface RequestSchema {
  body?: ZodType
  params?: ZodType
  query?: ZodType
}

export function validate(schema: RequestSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (schema.body) {
      const result = schema.body.safeParse(req.body)
      if (!result.success) return next(new ValidationError(result.error.issues[0]?.message))
      req.body = result.data
    }

    if (schema.params) {
      const result = schema.params.safeParse(req.params)
      if (!result.success) return next(new ValidationError(result.error.issues[0]?.message))
      req.params = result.data as Request['params']
    }

    if (schema.query) {
      const result = schema.query.safeParse(req.query)
      if (!result.success) return next(new ValidationError(result.error.issues[0]?.message))
      req.query = result.data as Request['query']
    }

    next()
  }
}
