import { Suspense } from "react";
import { exigirPerfil } from "@/lib/dal";
import type { Perfil } from "@/lib/types";
import { UserMenu } from "./user-menu";

async function Guarda({ perfil, children }: { perfil: Perfil; children: React.ReactNode }) {
  await exigirPerfil(perfil);
  return children;
}

async function UsuarioLogado({ perfil }: { perfil: Perfil }) {
  return <UserMenu usuario={await exigirPerfil(perfil)} />;
}

function Carregando() {
  return (
    <div className="space-y-3">
      <div className="h-7 w-48 animate-pulse rounded bg-muted" />
      <div className="h-32 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

/** Só renderiza o conteúdo para o perfil indicado; o shell ao redor carrega sem esperar a sessão. */
export function AreaProtegida({ perfil, children }: { perfil: Perfil; children: React.ReactNode }) {
  return (
    <Suspense fallback={<Carregando />}>
      <Guarda perfil={perfil}>{children}</Guarda>
    </Suspense>
  );
}

export function UsuarioHeader({ perfil }: { perfil: Perfil }) {
  return (
    <Suspense fallback={<div className="size-8 animate-pulse rounded-full bg-muted" />}>
      <UsuarioLogado perfil={perfil} />
    </Suspense>
  );
}
