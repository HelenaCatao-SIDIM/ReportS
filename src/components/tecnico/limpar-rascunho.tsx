"use client";

import { useEffect } from "react";

/** Apaga do celular o rascunho do check-out depois que a visita foi encerrada. */
export function LimparRascunho({ chave }: { chave: string }) {
  useEffect(() => {
    try {
      localStorage.removeItem(chave);
    } catch {}
  }, [chave]);
  return null;
}
