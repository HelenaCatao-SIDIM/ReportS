-- Remove o setor por completo do ReportS. Apaga as colunas que eram do ReportS:
--  - presencas.setor: a cópia do setor do participante gravada na presença.
--  - visitas.setor_nome: o nome do setor congelado nas visitas antigas.
-- A coluna client_users.setor é da plataforma (SINC) e não é tocada aqui: o ReportS só deixa de ler e gravar.

ALTER TABLE "presencas" DROP COLUMN "setor";
ALTER TABLE "visitas" DROP COLUMN "setor_nome";
