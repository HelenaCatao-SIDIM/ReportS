"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";

/** A tela de presença é passada de mão em mão entre os participantes: nela não ficam o menu do usuário nem a barra de navegação. */
const NA_PRESENCA = /^\/tecnico\/visita\/[^/]+\/presenca\/?$/;

function Condicional({ children }: { children: React.ReactNode }) {
  return NA_PRESENCA.test(usePathname()) ? null : children;
}

export function OcultoNaPresenca({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Condicional>{children}</Condicional>
    </Suspense>
  );
}
