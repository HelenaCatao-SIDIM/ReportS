-- A visita lançada pela Administração (lançamento retroativo) grava meio = 'retroativa'.
ALTER TABLE "visitas" DROP CONSTRAINT "visitas_meio";
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_meio" CHECK ("meio" IN ('celular', 'computador', 'retroativa'));
