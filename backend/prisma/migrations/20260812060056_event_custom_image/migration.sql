-- Etapa 12 (.claude/plan/backend/12-storage-e-upload.md): banner próprio do organizador,
-- guardado à parte do pôster do catálogo. "imageUrl" continua sendo o que é exibido
-- (pôster do TMDb até o organizador enviar um banner); "catalogImageUrl" é o snapshot
-- imutável do pôster, preservado para o DELETE /events/:id/image voltar a ele;
-- "customImageKey" é a key no bucket Supabase quando "imageUrl" é um upload do
-- organizador (null enquanto o evento usa o pôster do catálogo).

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "catalogImageUrl" TEXT,
ADD COLUMN     "customImageKey" TEXT;

-- Backfill: todo evento já existente teve seu "imageUrl" preenchido a partir do
-- catálogo na criação (etapa 05) -- sem isto, eventos anteriores a esta migration
-- perderiam o fallback do pôster no primeiro DELETE de imagem.
UPDATE "Event" SET "catalogImageUrl" = "imageUrl" WHERE "catalogImageUrl" IS NULL;
