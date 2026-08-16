-- Habilita o Supabase Realtime (Postgres Changes) para `seat_state` -- sem isto, o
-- mapa de assentos em tempo real (front: `useSeatRealtime.ts`, canal
-- `postgres_changes` filtrado por `table: 'seat_state'`) nunca recebe eventos em
-- produção, mesmo com RLS e a política de leitura pública já corretas (migration
-- `20260812030000_realtime_rls_pg_cron`) -- publicação e política são coisas
-- diferentes: uma autoriza QUEM lê, a outra decide O QUE entra no fluxo de eventos.
--
-- A publicação `supabase_realtime` só existe no Supabase -- local (docker compose)
-- e CI usam postgres:16-alpine puro, sem essa publicação. Mesmo guard já usado para
-- pg_cron na migration anterior: local/CI seguem sem Realtime (cobertos pelo
-- fallback de polling do front, `usePollingFallback.ts`), e `prisma migrate deploy`
-- continua idêntico em todo ambiente -- nenhum passo manual extra no painel do
-- Supabase além de rodar as migrations.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'seat_state'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE "seat_state";
    END IF;
  ELSE
    RAISE NOTICE 'Publicação supabase_realtime indisponível (ambiente local/CI) -- Realtime não habilitado, fallback de polling cobre.';
  END IF;
END $$;
