-- Ocupações (CBO) que se enquadram em cada equipe: só algumas, escolhidas da tabela CBO.
CREATE TABLE "equipe_cbos" (
    "equipe_id" TEXT NOT NULL,
    "cbo_codigo" TEXT NOT NULL,

    CONSTRAINT "equipe_cbos_pkey" PRIMARY KEY ("equipe_id","cbo_codigo")
);

CREATE INDEX "equipe_cbos_cbo_codigo_idx" ON "equipe_cbos"("cbo_codigo");

ALTER TABLE "equipe_cbos" ADD CONSTRAINT "equipe_cbos_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "equipe_cbos" ADD CONSTRAINT "equipe_cbos_cbo_codigo_fkey" FOREIGN KEY ("cbo_codigo") REFERENCES "cbo"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
