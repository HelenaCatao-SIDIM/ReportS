"use client";

import { useEffect } from "react";
import { apagarRascunho } from "./rascunho";

/** Apaga do aparelho os rascunhos que já cumpriram o papel (visita encerrada ou check-in feito). */
export function LimparRascunho({ chave }: { chave: string | string[] }) {
  const chaves = (Array.isArray(chave) ? chave : [chave]).join("|");
  useEffect(() => {
    for (const c of chaves.split("|")) apagarRascunho(c);
  }, [chaves]);
  return null;
}
