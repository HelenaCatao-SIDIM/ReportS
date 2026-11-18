-- Log central de auditoria: toda alteração feita pela Administração no sistema (cadastros, visitas, relatórios…).
-- Guarda o nome do autor e um rótulo da entidade no momento, para ler sem depender de joins nem do estado atual.
CREATE TABLE "auditoria" (
    "id" TEXT NOT NULL,
    "em" TIMESTAMP(3) NOT NULL,
    "autor_id" BIGINT NOT NULL,
    "autor_nome" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" TEXT NOT NULL DEFAULT '',
    "rotulo" TEXT NOT NULL DEFAULT '',
    "acao" TEXT NOT NULL,
    "mudancas" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auditoria_em_idx" ON "auditoria"("em");

CREATE INDEX "auditoria_entidade_idx" ON "auditoria"("entidade", "entidade_id");
