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

    const mime = await detectImageMime(buffer)
    if (!mime) throw new AppError('INVALID_IMAGE', 'Arquivo de imagem inválido', 400)

    const { url, key } = await this.storage.upload({ buffer, mimeType: mime, folder: `events/${eventId}` })

    const updated = await this.repo.update(prisma, eventId, { imageUrl: url, customImageKey: key })

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

    if (!event.customImageKey) return event

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
