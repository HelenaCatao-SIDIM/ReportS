-- Fotos extras por técnico na visita conjunta: cada técnico tem as próprias (as anotações já eram por técnico).
-- Temas, equipes e participantes seguem compartilhados. Só acrescenta coluna (não apaga nada).
ALTER TABLE "visita_tecnicos" ADD COLUMN "fotos_extras" JSONB NOT NULL DEFAULT '[]';
