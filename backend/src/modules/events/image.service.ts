import type { Logger } from 'pino'
import { prisma } from '../../lib/prisma'
import { AppError, ForbiddenError, NotFoundError } from '../../shared/errors'
import type { EventsRepository } from './events.repository'
import { detectImageMime } from './providers/image-mime'
import type { StorageProvider } from './providers/storage-provider'

export class ImageService {
  constructor(
    private readonly repo: EventsRepository,
    private readonly storage: StorageProvider,
  ) {}

  async upload(eventId: string, userId: string, buffer: Buffer, log: Logger) {
    const event = await this.repo.findById(prisma, eventId)
    if (!event) throw new NotFoundError('Evento')
    if (event.organizerId !== userId) throw new ForbiddenError()

    // magic bytes, não a extensão do nome nem o Content-Type do multipart -- os dois
    // são controlados por quem envia (§5.3.4). Rejeição não detalha o motivo.
    const mime = await detectImageMime(buffer)
    if (!mime) throw new AppError('INVALID_IMAGE', 'Arquivo de imagem inválido', 400)

    const { url, key } = await this.storage.upload({ buffer, mimeType: mime, folder: `events/${eventId}` })

    // I/O externo (upload) já terminou antes de tocar o banco -- transação curta,
    // só a escrita local (§5.5.3)
    const updated = await this.repo.update(prisma, eventId, { imageUrl: url, customImageKey: key })

    // imagem anterior removida DEPOIS do commit -- órfão em bucket é desperdício,
    // referência quebrada (removendo antes e a escrita no banco falhando) é bug visível
    if (event.customImageKey) {
      this.storage
        .remove(event.customImageKey)
        .catch((err: unknown) => log.error({ msg: 'falha ao remover imagem anterior do bucket', err, key: event.customImageKey }))
    }

    log.info({ msg: 'event image uploaded', eventId, key })
    return updated
  }

  async remove(eventId: string, userId: string, log: Logger) {
    const event = await this.repo.findById(prisma, eventId)
    if (!event) throw new NotFoundError('Evento')
    if (event.organizerId !== userId) throw new ForbiddenError()

    if (!event.customImageKey) return event // idempotente -- já está no pôster do catálogo

    // nunca deixa o evento sem imagem -- volta para o snapshot do catálogo (§5.3.4)
    const updated = await this.repo.update(prisma, eventId, {
      imageUrl: event.catalogImageUrl,
      customImageKey: null,
    })

    const removedKey = event.customImageKey
    this.storage.remove(removedKey).catch((err: unknown) => log.error({ msg: 'falha ao remover imagem do bucket', err, key: removedKey }))

    log.info({ msg: 'event image removed -- revertido ao pôster do catálogo', eventId })
    return updated
  }
}
