-- Log de requisições que passam pelo proxy: o que entra e o desfecho (passou, mandou pro login, mandou pro início).
-- Só cria tabela e índice (não apaga nada).
CREATE TABLE "requisicoes" (
    "id" TEXT NOT NULL,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metodo" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "usuario_id" BIGINT,
    "ip" TEXT NOT NULL DEFAULT '',
    "desfecho" TEXT NOT NULL,

    CONSTRAINT "requisicoes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "requisicoes_em_idx" ON "requisicoes"("em");
