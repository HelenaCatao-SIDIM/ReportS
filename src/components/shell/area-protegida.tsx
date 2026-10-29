import { Suspense } from "react";
import { exigirAdministracao, exigirTecnico } from "@/lib/dal";
import { PERMISSOES_DA_TELA } from "@/lib/permissoes";
import { AdminMobileNav, AdminSidebar } from "./admin-nav";
import { UserMenu } from "./user-menu";

export type Area = "admin" | "tecnico";

const exigir = (area: Area) => (area === "admin" ? exigirAdministracao() : exigirTecnico());

async function Guarda({ area, children }: { area: Area; children: React.ReactNode }) {
  await exigir(area);
  return children;
}

async function UsuarioLogado({ area }: { area: Area }) {
  return <UserMenu usuario={await exigir(area)} />;
}

export function Carregando() {
  return (
    <div className="space-y-3">
      <div className="h-7 w-48 animate-pulse rounded bg-muted" />
      <div className="h-32 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

/** Só renderiza o conteúdo para quem tem acesso à área; o shell ao redor carrega sem esperar a sessão. */
export function AreaProtegida({ area, children }: { area: Area; children: React.ReactNode }) {
  return (
    <Suspense fallback={<Carregando />}>
      <Guarda area={area}>{children}</Guarda>
    </Suspense>
  );
}

export function UsuarioHeader({ area }: { area: Area }) {
  return (
    <Suspense fallback={<div className="size-8 animate-pulse rounded-full bg-muted" />}>
      <UsuarioLogado area={area} />
    </Suspense>
  );
}

async function GuardaTelaConteudo({ tela, children }: { tela: string; children: React.ReactNode }) {
  await exigirAdministracao(...(PERMISSOES_DA_TELA[tela] ?? []));
  return children;
}

/** Guarda de uma seção da Administração: exige a permissão da tela (ver PERMISSOES_DA_TELA). Ações têm a própria checagem. */
export function GuardaTela({ tela, children }: { tela: string; children: React.ReactNode }) {
  return (
    <Suspense fallback={<Carregando />}>
      <GuardaTelaConteudo tela={tela}>{children}</GuardaTelaConteudo>
    </Suspense>
  );
}

async function MenuLateralComSessao() {
  return <AdminSidebar permissoes={(await exigirAdministracao()).permissoes} />;
}

async function MenuMovelComSessao() {
  return <AdminMobileNav permissoes={(await exigirAdministracao()).permissoes} />;
}

/** Menu da Administração com só as telas que as permissões do usuário liberam. */
export function MenuLateral() {
  return (
    <Suspense fallback={<AdminSidebar />}>
      <MenuLateralComSessao />
    </Suspense>
  );
}

export function MenuMovel() {
  return (
    <Suspense fallback={<AdminMobileNav />}>
      <MenuMovelComSessao />
    </Suspense>
  );
}
