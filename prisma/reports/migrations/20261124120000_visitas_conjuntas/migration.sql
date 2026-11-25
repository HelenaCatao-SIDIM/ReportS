-- Visitas conjuntas: técnicos convidados numa mesma visita (o principal fica em visitas.tecnico_id).
-- Cada convidado tem o próprio check-in, check-out, foto e anotações. Só cria tabela e índices (não apaga nada).
CREATE TABLE "visita_tecnicos" (
    "visita_id" TEXT NOT NULL,
    "tecnico_id" BIGINT NOT NULL,
    "papel" TEXT NOT NULL DEFAULT 'convidado',
    "estado" TEXT NOT NULL DEFAULT 'convidado',
    "convidado_em" TIMESTAMP(3) NOT NULL,
    "entrada" TIMESTAMP(3),
    "saida" TIMESTAMP(3),
    "checkin" JSONB,
    "checkout" JSONB,
    "meio" TEXT NOT NULL DEFAULT '',
    "distancia_checkin_m" INTEGER,
    "raio_checkin_m" INTEGER,
    "foto_ambiente" JSONB,
    "print_tela" JSONB,
    "observacoes" TEXT NOT NULL DEFAULT '',
    "pendencias" TEXT NOT NULL DEFAULT '',
    "proximos_passos" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "visita_tecnicos_pkey" PRIMARY KEY ("visita_id","tecnico_id")
);

CREATE INDEX "visita_tecnicos_tecnico_id_idx" ON "visita_tecnicos"("tecnico_id");

-- Um vínculo aberto por técnico (convite pendente ou ativo): garante que um técnico não esteja em duas visitas ao mesmo tempo.
CREATE UNIQUE INDEX "visita_tecnicos_um_ativo_por_tecnico" ON "visita_tecnicos"("tecnico_id") WHERE "saida" IS NULL;

ALTER TABLE "visita_tecnicos" ADD CONSTRAINT "visita_tecnicos_visita_id_fkey" FOREIGN KEY ("visita_id") REFERENCES "visitas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "visita_tecnicos" ADD CONSTRAINT "visita_tecnicos_estado" CHECK ("estado" IN ('convidado', 'ativo', 'encerrado'));
