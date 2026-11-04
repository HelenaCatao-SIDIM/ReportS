-- CreateTable
CREATE TABLE "cronograma_itens" (
    "id" TEXT NOT NULL,
    "cliente_id" BIGINT NOT NULL,
    "contrato_id" TEXT NOT NULL,
    "estabelecimento_id" TEXT NOT NULL,
    "setor_id" TEXT,
    "tipo" TEXT NOT NULL,
    "prazo" DATE NOT NULL,
    "observacao" TEXT NOT NULL DEFAULT '',
    "cancelado" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cronograma_itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cronograma_itens_contrato_id_prazo_idx" ON "cronograma_itens"("contrato_id", "prazo");

-- CreateIndex
CREATE INDEX "cronograma_itens_cliente_id_idx" ON "cronograma_itens"("cliente_id");

-- CreateIndex
CREATE INDEX "cronograma_itens_estabelecimento_id_idx" ON "cronograma_itens"("estabelecimento_id");

-- AddForeignKey
ALTER TABLE "cronograma_itens" ADD CONSTRAINT "cronograma_itens_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cronograma_itens" ADD CONSTRAINT "cronograma_itens_estabelecimento_id_fkey" FOREIGN KEY ("estabelecimento_id") REFERENCES "estabelecimentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cronograma_itens" ADD CONSTRAINT "cronograma_itens_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
