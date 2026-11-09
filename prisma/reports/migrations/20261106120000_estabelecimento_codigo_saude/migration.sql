-- Estabelecimentos trazidos do SIDIM Saúde: o código de lá (para não duplicar ao importar de novo) e o CNES.
-- Os cadastrados à mão ficam com o código nulo (o índice único aceita vários nulos) e o CNES vazio.
ALTER TABLE "estabelecimentos" ADD COLUMN "codigo_saude" TEXT;
ALTER TABLE "estabelecimentos" ADD COLUMN "cnes" TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX "estabelecimentos_cliente_id_codigo_saude_key" ON "estabelecimentos"("cliente_id", "codigo_saude");
