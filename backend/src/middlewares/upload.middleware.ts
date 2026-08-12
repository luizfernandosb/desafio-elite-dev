import multer, { MulterError } from 'multer'
import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../shared/errors'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

// memoryStorage -- o buffer vai direto para a detecção de magic bytes, sem tocar disco.
// `limits.fileSize` interrompe a leitura assim que o limite é excedido; o arquivo de 6MB
// do critério de aceite nunca chega a ser bufferizado inteiro (§5.3.4).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
}).single('image')

// Qualquer rejeição do multer (tamanho, mais de 1 arquivo) vira o mesmo 400
// INVALID_IMAGE do resto da validação de imagem -- não expõe qual limite foi violado.
export function uploadImage(req: Request, _res: Response, next: NextFunction) {
  upload(req, _res, (err: unknown) => {
    if (err instanceof MulterError) return next(new AppError('INVALID_IMAGE', 'Arquivo de imagem inválido', 400))
    if (err) return next(err)
    next()
  })
}
