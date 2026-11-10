import { Suspense } from "react";
import { listarParaCheckin } from "@/lib/repo/contratos";
import { listarComPermissao } from "@/lib/repo/usuarios";
import { listarEquipes } from "@/lib/repo/equipes";
import { listarTemas } from "@/lib/repo/temas";
import { PERMISSOES } from "@/lib/permissoes";
import { equipesDaVisita } from "@/lib/regras-visita";
import { PageHeader } from "@/components/shell/placeholder";
import { RetroativaForm } from "./retroativa-form";

const DESCRICAO =
  "Registre uma visita que já aconteceu. Fica igual a uma visita normal, sem o que depende de estar no local: sem GPS, sem foto obrigatória e sem assinatura na presença. Ela fica marcada como lançamento retroativo.";

export default function VisitaRetroativaPage() {
  return (
    <div className="max-w-5xl">
      <PageHeader titulo="Lançar visita retroativa" descricao={DESCRICAO} />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  const [clientes, tecnicos, equipes, temas] = await Promise.all([
    listarParaCheckin(),
    listarComPermissao(PERMISSOES.tecnico),
    listarEquipes(),
    listarTemas(),
  ]);
  return (
    <RetroativaForm
      clientes={clientes}
      tecnicos={tecnicos.map(({ id, nome }) => ({ id, nome }))}
      equipes={equipesDaVisita(equipes, []).map(({ id, nome }) => ({ id, nome }))}
      temas={temas.filter((t) => t.ativo).map(({ id, nome, sistema, modulo }) => ({ id, nome, sistema, modulo }))}
    />
  );
}
