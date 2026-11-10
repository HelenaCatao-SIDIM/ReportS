-- Horário combinado do item do cronograma (texto livre e opcional, ex.: "09:30 e 14h"). Só informativo:
-- não entra na regra de item repetido nem no cumprimento.
ALTER TABLE "cronograma_itens" ADD COLUMN "horario" TEXT NOT NULL DEFAULT '';
