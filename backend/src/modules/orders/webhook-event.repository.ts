import type { Db } from '../../shared/db'

// PK = event.id do Stripe -- INSERT falhando com P2002 é a defesa contra entrega
// dupla real do Stripe (§4.5, I-8)
export class WebhookEventRepository {
  create(db: Db, id: string, type: string) {
    return db.processedWebhookEvent.create({ data: { id, type } })
  }
}
