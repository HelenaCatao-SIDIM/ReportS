"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const INTERVALO_MS = 3000;
const TENTATIVAS_PADRAO = 8;

/**
 * Enquanto o CEP está sendo identificado em segundo plano, busca de novo os dados da página a cada 3 s
 * (no máximo `tentativas` vezes, 8 por padrão), para o CEP aparecer sem ninguém recarregar a tela.
 */
export function AtualizarEnquantoPendente({ pendente, tentativas: maximo = TENTATIVAS_PADRAO }: { pendente: boolean; tentativas?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (!pendente) return;
    let feitas = 0;
    const timer = setInterval(() => {
      feitas += 1;
      router.refresh();
      if (feitas >= maximo) clearInterval(timer);
    }, INTERVALO_MS);
    return () => clearInterval(timer);
  }, [pendente, maximo, router]);

  return null;
}
