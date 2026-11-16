-- Novo tipo de visita: Análise de ambiente (presencial, sem assinatura na presença).
ALTER TABLE "visitas" DROP CONSTRAINT "visitas_tipo";
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_tipo" CHECK ("tipo" IN ('treinamento', 'implantacao', 'suporte_presencial', 'reuniao', 'visita_tecnica', 'treinamento_online', 'analise_ambiente'));
