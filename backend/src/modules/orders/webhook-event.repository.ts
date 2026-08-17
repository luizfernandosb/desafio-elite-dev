import type { Db } from '../../shared/db'

export class WebhookEventRepository {
  create(db: Db, id: string, type: string) {
    return db.processedWebhookEvent.create({ data: { id, type } })
  }
}
