-- Remove os setores dos estabelecimentos. O setor passou a ser só cadastro do estabelecimento e saiu de vez;
-- na visita o que vale é a equipe. Antes de apagar as tabelas e colunas, congela o nome do setor nas visitas
-- que o tinham, para o histórico continuar legível (sentinela "—" para quem não tinha setor).

-- 1. Congela o nome do setor na própria visita.
ALTER TABLE "visitas" ADD COLUMN "setor_nome" TEXT NOT NULL DEFAULT '—';

UPDATE "visitas" v
SET "setor_nome" = COALESCE(s."nome", v."setor_outro", '—')
FROM "setores" s
WHERE v."setor_id" = s."id";

UPDATE "visitas"
SET "setor_nome" = "setor_outro"
WHERE "setor_id" IS NULL AND "setor_outro" IS NOT NULL AND "setor_outro" <> '';

-- 2. Setores acrescentados à visita depois do check-in: deixam de existir.
DROP TABLE "visita_setores";

-- 3. A visita não aponta mais para um setor cadastrado (a FK sai junto com a coluna).
ALTER TABLE "visitas" DROP COLUMN "setor_id";
ALTER TABLE "visitas" DROP COLUMN "setor_outro";

-- 4. Cronograma: o setor já era legado (passou a usar equipes); some com a referência.
ALTER TABLE "cronograma_itens" DROP COLUMN "setor_id";

-- 5. Cadastro de setores do estabelecimento: removido.
DROP TABLE "setores";
