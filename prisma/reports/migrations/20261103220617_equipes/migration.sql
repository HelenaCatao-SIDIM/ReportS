-- CreateTable
CREATE TABLE "equipes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipe_temas" (
    "equipe_id" TEXT NOT NULL,
    "tema_id" TEXT NOT NULL,

    CONSTRAINT "equipe_temas_pkey" PRIMARY KEY ("equipe_id","tema_id")
);

-- CreateTable
CREATE TABLE "visita_equipes" (
    "visita_id" TEXT NOT NULL,
    "equipe_id" TEXT NOT NULL,

    CONSTRAINT "visita_equipes_pkey" PRIMARY KEY ("visita_id","equipe_id")
);

-- CreateIndex
CREATE INDEX "equipe_temas_tema_id_idx" ON "equipe_temas"("tema_id");

-- CreateIndex
CREATE INDEX "visita_equipes_equipe_id_idx" ON "visita_equipes"("equipe_id");

-- AddForeignKey
ALTER TABLE "equipe_temas" ADD CONSTRAINT "equipe_temas_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipe_temas" ADD CONSTRAINT "equipe_temas_tema_id_fkey" FOREIGN KEY ("tema_id") REFERENCES "temas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visita_equipes" ADD CONSTRAINT "visita_equipes_visita_id_fkey" FOREIGN KEY ("visita_id") REFERENCES "visitas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visita_equipes" ADD CONSTRAINT "visita_equipes_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
