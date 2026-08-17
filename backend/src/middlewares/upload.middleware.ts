import multer, { MulterError } from 'multer'
import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../shared/errors'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
}).single('image')

export function uploadImage(req: Request, _res: Response, next: NextFunction) {
  upload(req, _res, (err: unknown) => {
    if (err instanceof MulterError) return next(new AppError('INVALID_IMAGE', 'Arquivo de imagem inválido', 400))
    if (err) return next(err)
    next()
  })
}
