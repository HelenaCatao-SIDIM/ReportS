-- A comprovação da presença do contrato passa a aceitar "login" (participante entra com o login do Saúde), além de
-- "nominal" e "assinado". É uma escolha única: a visita exige assinatura OU login, conforme o contrato.
ALTER TABLE "contratos" DROP CONSTRAINT "contratos_nivel";

ALTER TABLE "contratos" ADD CONSTRAINT "contratos_nivel" CHECK ("nivel" IN ('nominal', 'assinado', 'login'));
