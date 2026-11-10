-- O cronograma passa a pedir equipes em vez de setor. A coluna setor_id fica só como registro dos itens antigos:
-- remover o setor do estabelecimento não é mais barrado pelo cronograma (o item perde a referência).
ALTER TABLE "cronograma_itens" DROP CONSTRAINT "cronograma_itens_setor_id_fkey";
ALTER TABLE "cronograma_itens" ADD CONSTRAINT "cronograma_itens_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Equipes que o item pede. Sem nenhuma, qualquer visita do tipo no estabelecimento cumpre o item.
CREATE TABLE "cronograma_item_equipes" (
    "item_id" TEXT NOT NULL,
    "equipe_id" TEXT NOT NULL,

    CONSTRAINT "cronograma_item_equipes_pkey" PRIMARY KEY ("item_id","equipe_id")
);

CREATE INDEX "cronograma_item_equipes_equipe_id_idx" ON "cronograma_item_equipes"("equipe_id");

ALTER TABLE "cronograma_item_equipes" ADD CONSTRAINT "cronograma_item_equipes_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "cronograma_itens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cronograma_item_equipes" ADD CONSTRAINT "cronograma_item_equipes_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
