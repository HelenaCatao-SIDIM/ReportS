-- Vários tipos numa visita (ex.: visita técnica + treinamento). Mantém a coluna `tipo` (principal) e a CHECK existente.
-- Só acrescenta a coluna (DDL puro). As linhas antigas ficam com `tipos` vazio e o código cai no `tipo` (fallback).
ALTER TABLE "visitas" ADD COLUMN "tipos" TEXT[] NOT NULL DEFAULT '{}';
