-- Novo status do relatório: "emitido" (versão gerada, ainda não enviada por e-mail). Só amplia a regra; nada existente muda.
ALTER TABLE "relatorios" DROP CONSTRAINT "relatorios_status";
ALTER TABLE "relatorios" ADD CONSTRAINT "relatorios_status" CHECK ("status" IN ('rascunho', 'emitido', 'enviado', 'ajuste_solicitado', 'aprovado'));
