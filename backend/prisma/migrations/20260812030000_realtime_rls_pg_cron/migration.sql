-- Etapa 11 (.claude/plan/backend/11-realtime-e-rls.md): RLS para a anon key do Supabase
-- e os três jobs de pg_cron. A escrita dupla em seat_state (decisão registrada no README,
-- alternativa descartada: trigger no Postgres) já está em produção desde as etapas 05/06/07
-- -- ver seat-state.repository.ts, seat-hold.service.ts e orders.service.ts.

-- ============================================================================
-- 1. RLS -- o banco passa a ter duas portas (§7.9). O Prisma conecta como dono
-- das tabelas (postgres): RLS é ignorado nessa porta, autorização continua sendo
-- os middlewares da etapa 03. A anon key do Supabase Realtime é a ÚNICA proteção
-- na segunda porta -- por isso toda tabela trava por padrão e só seat_state abre.
-- ============================================================================

-- Local (docker compose) e CI usam postgres:16-alpine, que não tem o role "anon"
-- do Supabase. Sem este guard, "TO anon" abaixo falharia com "role anon does not
-- exist" fora do Supabase. No Supabase o role já existe e o IF NOT EXISTS é no-op.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END $$;

ALTER TABLE "User"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RefreshToken"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Event"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Seat"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeatHold"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Ticket"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ValidationLog"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CatalogCache"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProcessedWebhookEvent" ENABLE ROW LEVEL SECURITY; -- criada na etapa 07, fora da lista original do plano; mesma régua de "toda tabela trava por padrão"
ALTER TABLE "seat_state"            ENABLE ROW LEVEL SECURITY;

-- Única política de leitura do projeto: disponibilidade de assento é pública,
-- deliberado (§4.4), não acidental. Nenhuma política de INSERT/UPDATE/DELETE
-- para anon -- escrita é só pela API (Porta 1), nunca pelo cliente Supabase.
CREATE POLICY "seat_state_public_read" ON "seat_state" FOR SELECT TO anon USING (true);

-- Sem FORCE ROW LEVEL SECURITY em nenhuma tabela -- isso quebraria a Porta 1
-- (o Prisma é o dono das tabelas e precisa continuar ignorando RLS).

-- ============================================================================
-- 2. pg_cron -- só existe como extensão hospedada no Supabase (Database →
-- Extensions). postgres:16-alpine (docker-compose local e o serviço do CI) não
-- traz o binário: um `CREATE EXTENSION pg_cron` incondicional derrubaria todo
-- `prisma migrate deploy` fora do Supabase. O guard abaixo agenda os três jobs
-- só quando a extensão está disponível; local/CI seguem sem eles e a aplicação
-- funciona igual, coberta pela expiração preguiçosa na leitura (etapa 06) --
-- só a *percepção* do assento livre atrasa até ~60s, nunca a correção.
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;

    -- 1. holds vencidos (§4.4.3) -- este UPDATE em seat_state é quem dispara o
    -- Realtime, sem nenhuma linha de código de broadcast no back-end.
    -- "AND s.status = 'HELD'" evita reverter um assento já SOLD por corrida
    -- com o webhook do Stripe.
    PERFORM cron.schedule('expire-seat-holds', '* * * * *', $cron$
      WITH expired AS (
        UPDATE "SeatHold" SET "releasedAt" = now()
         WHERE "releasedAt" IS NULL AND "expiresAt" < now()
        RETURNING "seatId"
      )
      UPDATE "seat_state" s SET status = 'FREE', "expiresAt" = NULL, "updatedAt" = now()
        FROM expired e WHERE s."seatId" = e."seatId" AND s.status = 'HELD';
    $cron$);

    -- 2. pedidos vencidos (etapa 07)
    PERFORM cron.schedule('expire-orders', '* * * * *', $cron$
      UPDATE "Order" SET status = 'EXPIRED'
       WHERE status = 'PENDING' AND "expiresAt" < now();
    $cron$);

    -- 3. cache do TMDb (etapa 04)
    PERFORM cron.schedule('purge-catalog-cache', '0 * * * *', $cron$
      DELETE FROM "CatalogCache" WHERE "expiresAt" < now();
    $cron$);
  ELSE
    RAISE NOTICE 'pg_cron indisponível neste Postgres -- jobs não agendados (ambiente local/CI, ver README).';
  END IF;
END $$;
