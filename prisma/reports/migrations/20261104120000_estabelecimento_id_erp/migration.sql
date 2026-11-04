-- AlterTable
ALTER TABLE "estabelecimentos" ADD COLUMN "id_erp" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "estabelecimentos_cliente_id_id_erp_key" ON "estabelecimentos"("cliente_id", "id_erp");
