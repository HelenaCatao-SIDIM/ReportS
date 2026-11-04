
-- CreateTable
CREATE TABLE "visita_setores" (
    "id" TEXT NOT NULL,
    "visita_id" TEXT NOT NULL,
    "setor_id" TEXT,
    "setor_outro" TEXT,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "visita_setores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visita_setores_setor_id_idx" ON "visita_setores"("setor_id");

-- CreateIndex
CREATE UNIQUE INDEX "visita_setores_visita_id_setor_id_key" ON "visita_setores"("visita_id", "setor_id");

-- AddForeignKey
ALTER TABLE "visita_setores" ADD CONSTRAINT "visita_setores_visita_id_fkey" FOREIGN KEY ("visita_id") REFERENCES "visitas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visita_setores" ADD CONSTRAINT "visita_setores_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

