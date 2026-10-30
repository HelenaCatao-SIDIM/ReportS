-- CreateTable
CREATE TABLE "estabelecimentos" (
    "id" TEXT NOT NULL,
    "cliente_id" BIGINT NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "raio_metros" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estabelecimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setores" (
    "id" TEXT NOT NULL,
    "estabelecimento_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "setores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aprovadores" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aprovadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos" (
    "id" TEXT NOT NULL,
    "cliente_id" BIGINT NOT NULL,
    "sistema_do_cliente_id" BIGINT NOT NULL,
    "texto" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "exige_cpf" BOOLEAN NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_aprovadores" (
    "contrato_id" TEXT NOT NULL,
    "aprovador_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "contrato_aprovadores_pkey" PRIMARY KEY ("contrato_id","aprovador_id")
);

-- CreateTable
CREATE TABLE "temas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sistema" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "temas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cbo" (
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,

    CONSTRAINT "cbo_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "visitas" (
    "id" TEXT NOT NULL,
    "tecnico_id" BIGINT NOT NULL,
    "cliente_id" BIGINT NOT NULL,
    "contrato_id" TEXT NOT NULL,
    "estabelecimento_id" TEXT NOT NULL,
    "setor_id" TEXT,
    "setor_outro" TEXT,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "entrada" TIMESTAMP(3) NOT NULL,
    "saida" TIMESTAMP(3),
    "checkin" JSONB,
    "checkout" JSONB,
    "meio" TEXT NOT NULL,
    "distancia_checkin_m" INTEGER,
    "raio_checkin_m" INTEGER,
    "foto_ambiente" JSONB,
    "print_tela" JSONB,
    "link_reuniao" TEXT,
    "tema_adicional" TEXT NOT NULL DEFAULT '',
    "fotos_extras" JSONB NOT NULL DEFAULT '[]',
    "observacoes" TEXT NOT NULL DEFAULT '',
    "pendencias" TEXT NOT NULL DEFAULT '',
    "proximos_passos" TEXT NOT NULL DEFAULT '',
    "encerrada_pela_administracao" BOOLEAN NOT NULL DEFAULT false,
    "relatorio_id" TEXT,

    CONSTRAINT "visitas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visita_temas" (
    "visita_id" TEXT NOT NULL,
    "tema_id" TEXT NOT NULL,

    CONSTRAINT "visita_temas_pkey" PRIMARY KEY ("visita_id","tema_id")
);

-- CreateTable
CREATE TABLE "presencas" (
    "id" TEXT NOT NULL,
    "visita_id" TEXT NOT NULL,
    "participante_id" BIGINT NOT NULL,
    "estado" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cbo_codigo" TEXT,
    "cbo_titulo" TEXT,
    "setor" TEXT NOT NULL DEFAULT '',
    "cpf" TEXT,
    "confirmacao" TEXT NOT NULL,
    "assinatura" TEXT,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "presencas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alteracoes_visita" (
    "id" TEXT NOT NULL,
    "visita_id" TEXT NOT NULL,
    "autor_id" BIGINT NOT NULL,
    "autor_nome" TEXT NOT NULL,
    "em" TIMESTAMP(3) NOT NULL,
    "acao" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "mudancas" JSONB NOT NULL,

    CONSTRAINT "alteracoes_visita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relatorios" (
    "id" TEXT NOT NULL,
    "cliente_id" BIGINT NOT NULL,
    "contrato_id" TEXT NOT NULL,
    "de" DATE NOT NULL,
    "ate" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relatorios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "versoes_relatorio" (
    "id" TEXT NOT NULL,
    "relatorio_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "emitido_em" TIMESTAMP(3) NOT NULL,
    "visita_ids" JSONB NOT NULL,
    "pdf_url" TEXT,
    "pdf_tamanho" INTEGER NOT NULL DEFAULT 0,
    "enviado_para" JSONB NOT NULL,
    "conteudo" JSONB,
    "decisao" JSONB,

    CONSTRAINT "versoes_relatorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "links_aprovacao" (
    "token" TEXT NOT NULL,
    "relatorio_id" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "aprovador_id" TEXT,
    "aprovador_nome" TEXT NOT NULL,
    "aprovador_cargo" TEXT NOT NULL,
    "aprovador_email" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL,
    "invalidado_em" TIMESTAMP(3),

    CONSTRAINT "links_aprovacao_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "arquivos" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "caminho" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arquivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emails" (
    "id" TEXT NOT NULL,
    "para_nome" TEXT NOT NULL,
    "para_email" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "anexos" JSONB NOT NULL DEFAULT '[]',
    "botao" JSONB,
    "enviado_em" TIMESTAMP(3) NOT NULL,
    "relatorio_id" TEXT,
    "situacao" TEXT NOT NULL,
    "id_mensagem" TEXT,
    "erro" TEXT,
    "redirecionado_para" TEXT,

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "estabelecimentos_cliente_id_idx" ON "estabelecimentos"("cliente_id");

-- CreateIndex
CREATE INDEX "setores_estabelecimento_id_idx" ON "setores"("estabelecimento_id");

-- CreateIndex
CREATE UNIQUE INDEX "aprovadores_email_key" ON "aprovadores"("email");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_sistema_do_cliente_id_key" ON "contratos"("sistema_do_cliente_id");

-- CreateIndex
CREATE INDEX "contratos_cliente_id_idx" ON "contratos"("cliente_id");

-- CreateIndex
CREATE INDEX "contrato_aprovadores_aprovador_id_idx" ON "contrato_aprovadores"("aprovador_id");

-- CreateIndex
CREATE INDEX "visitas_tecnico_id_status_idx" ON "visitas"("tecnico_id", "status");

-- CreateIndex
CREATE INDEX "visitas_contrato_id_status_idx" ON "visitas"("contrato_id", "status");

-- CreateIndex
CREATE INDEX "visitas_cliente_id_idx" ON "visitas"("cliente_id");

-- CreateIndex
CREATE INDEX "visitas_relatorio_id_idx" ON "visitas"("relatorio_id");

-- CreateIndex
CREATE INDEX "visitas_entrada_idx" ON "visitas"("entrada");

-- CreateIndex
CREATE UNIQUE INDEX "presencas_visita_id_participante_id_key" ON "presencas"("visita_id", "participante_id");

-- CreateIndex
CREATE INDEX "alteracoes_visita_visita_id_idx" ON "alteracoes_visita"("visita_id");

-- CreateIndex
CREATE INDEX "relatorios_contrato_id_idx" ON "relatorios"("contrato_id");

-- CreateIndex
CREATE INDEX "relatorios_cliente_id_idx" ON "relatorios"("cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "versoes_relatorio_relatorio_id_numero_key" ON "versoes_relatorio"("relatorio_id", "numero");

-- CreateIndex
CREATE INDEX "links_aprovacao_relatorio_id_versao_idx" ON "links_aprovacao"("relatorio_id", "versao");

-- CreateIndex
CREATE INDEX "emails_enviado_em_idx" ON "emails"("enviado_em");

-- AddForeignKey
ALTER TABLE "setores" ADD CONSTRAINT "setores_estabelecimento_id_fkey" FOREIGN KEY ("estabelecimento_id") REFERENCES "estabelecimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_aprovadores" ADD CONSTRAINT "contrato_aprovadores_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_aprovadores" ADD CONSTRAINT "contrato_aprovadores_aprovador_id_fkey" FOREIGN KEY ("aprovador_id") REFERENCES "aprovadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_estabelecimento_id_fkey" FOREIGN KEY ("estabelecimento_id") REFERENCES "estabelecimentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_relatorio_id_fkey" FOREIGN KEY ("relatorio_id") REFERENCES "relatorios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visita_temas" ADD CONSTRAINT "visita_temas_visita_id_fkey" FOREIGN KEY ("visita_id") REFERENCES "visitas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visita_temas" ADD CONSTRAINT "visita_temas_tema_id_fkey" FOREIGN KEY ("tema_id") REFERENCES "temas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presencas" ADD CONSTRAINT "presencas_visita_id_fkey" FOREIGN KEY ("visita_id") REFERENCES "visitas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alteracoes_visita" ADD CONSTRAINT "alteracoes_visita_visita_id_fkey" FOREIGN KEY ("visita_id") REFERENCES "visitas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relatorios" ADD CONSTRAINT "relatorios_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versoes_relatorio" ADD CONSTRAINT "versoes_relatorio_relatorio_id_fkey" FOREIGN KEY ("relatorio_id") REFERENCES "relatorios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "links_aprovacao" ADD CONSTRAINT "links_aprovacao_relatorio_id_fkey" FOREIGN KEY ("relatorio_id") REFERENCES "relatorios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Regras que o Prisma não descreve no schema, guardadas no banco.
-- Só uma visita em andamento por técnico.
CREATE UNIQUE INDEX "visitas_uma_em_andamento_por_tecnico" ON "visitas"("tecnico_id") WHERE "status" = 'em_andamento';

ALTER TABLE "visitas" ADD CONSTRAINT "visitas_status" CHECK ("status" IN ('em_andamento', 'encerrada', 'cancelada'));
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_tipo" CHECK ("tipo" IN ('treinamento', 'implantacao', 'suporte_presencial', 'reuniao', 'visita_tecnica', 'treinamento_online'));
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_meio" CHECK ("meio" IN ('celular', 'computador'));
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_nivel" CHECK ("nivel" IN ('nominal', 'assinado'));
ALTER TABLE "relatorios" ADD CONSTRAINT "relatorios_status" CHECK ("status" IN ('rascunho', 'enviado', 'ajuste_solicitado', 'aprovado'));
ALTER TABLE "relatorios" ADD CONSTRAINT "relatorios_periodo" CHECK ("de" <= "ate");
ALTER TABLE "presencas" ADD CONSTRAINT "presencas_confirmacao" CHECK ("confirmacao" IN ('nominal', 'assinatura'));
ALTER TABLE "cbo" ADD CONSTRAINT "cbo_codigo_formato" CHECK ("codigo" ~ '^[0-9]{6}$');
