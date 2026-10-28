"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const INTERVALO_MS = 3000;
const MAX_TENTATIVAS = 8;

/**
 * Enquanto o CEP está sendo identificado em segundo plano, busca de novo os dados da página a cada 3 s
 * (no máximo 8 vezes), para o CEP aparecer sem o técnico ou o gestor recarregarem a tela.
 */
export function AtualizarEnquantoPendente({ pendente }: { pendente: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!pendente) return;
    let tentativas = 0;
    const timer = setInterval(() => {
      tentativas += 1;
      router.refresh();
      if (tentativas >= MAX_TENTATIVAS) clearInterval(timer);
    }, INTERVALO_MS);
    return () => clearInterval(timer);
  }, [pendente, router]);

  return null;
}
