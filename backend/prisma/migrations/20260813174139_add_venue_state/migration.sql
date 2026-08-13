-- AlterTable: coluna nasce nullable para permitir backfill de linhas existentes
-- (5 na base de dev nesta sessão) antes de virar NOT NULL -- ver bugs.md #31,
-- mesmo raciocínio de dado real vs. dado que "deveria" existir.
ALTER TABLE "Event" ADD COLUMN "venueState" CHAR(2);

-- Backfill: até aqui `venueCity` era o único campo de local, e "Juiz de Fora - MG"
-- (dado real gravado antes deste campo existir) mostra exatamente o problema que o
-- select em cascata resolve -- UF embutida no texto livre da cidade, sem validação.
-- "São Paulo" -> SP explícito; qualquer outro valor cai em SP como default seguro
-- (nenhuma outra cidade existe na base nesta sessão, mas a cláusula ELSE evita uma
-- linha nula se algo novo for inserido nesta janela entre as duas migrations).
UPDATE "Event"
SET "venueState" = CASE
  WHEN "venueCity" ILIKE '%- MG' THEN 'MG'
  WHEN "venueCity" = 'São Paulo' THEN 'SP'
  ELSE 'SP'
END;

-- Cidade volta a conter só o nome da cidade -- a UF agora vive no campo próprio
UPDATE "Event" SET "venueCity" = 'Juiz de Fora' WHERE "venueCity" = 'Juiz de Fora - MG';

-- Só agora a coluna vira obrigatória, com toda linha já preenchida
ALTER TABLE "Event" ALTER COLUMN "venueState" SET NOT NULL;
