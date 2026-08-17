export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusHint: number = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Dados inválidos') {
    super('VALIDATION_ERROR', message, 400)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Não autenticado') {
    super('UNAUTHORIZED', message, 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado') {
    super('FORBIDDEN', message, 403)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} não encontrado`, 404)
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, 409, details)
  }
}

export class InvalidTransitionError extends AppError {
  constructor(transition: string) {
    super('INVALID_TRANSITION', `Transição inválida: ${transition}`, 422)
  }
}

export class RateLimitedError extends AppError {
  constructor(message = 'Muitas tentativas. Aguarde um instante.') {
    super('RATE_LIMITED', message, 429)
  }
}
