import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/dal";
import { buscarVisita } from "@/lib/repo/visitas";
import { buscarContrato } from "@/lib/repo/contratos";
import { listarUnidades } from "@/lib/repo/clientes";
import { ehPresencial } from "@/lib/visitas";
import { chaveRascunhoParticipante, exigeParticipantes } from "@/lib/regras-visita";
import { configLoginDoSistema } from "@/lib/repo/presenca-login";
import { conferirProva } from "@/lib/saude-login";
import { LimparRascunho } from "@/components/tecnico/limpar-rascunho";
import { PresencaAutoatendimento } from "./presenca-autoatendimento";

export default function PresencaPage({ params, searchParams }: PageProps<"/tecnico/visita/[id]/presenca">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Conteudo params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Conteudo({ params, searchParams }: Pick<PageProps<"/tecnico/visita/[id]/presenca">, "params" | "searchParams">) {
  const [{ id }, sp, usuario] = await Promise.all([params, searchParams, getUsuarioAtual()]);
  const v = await buscarVisita(id);
  // O técnico só vê as próprias visitas; encerrada não recebe mais presença.
  if (!v || !usuario || v.tecnicoId !== usuario.id) notFound();
  if (v.status !== "em_andamento") redirect(`/tecnico/visita/${id}`);
  const [contrato, unidades] = await Promise.all([buscarContrato(v.contratoId), listarUnidades(v.clienteId)]);
  // Login do participante no Saúde (ligado por tenant). O técnico abre o "modo sem login" por um link da tela da visita, com um token assinado.
  const exigeLogin = contrato ? !!(await configLoginDoSistema(contrato.sistemaDoClienteId)) : false;
  const token = typeof sp.tecnico === "string" ? sp.tecnico : "";
  const modoTecnico = exigeLogin && (await conferirProva(token, { finalidade: "sem_login", visitaId: id }));
  const setores = [...new Set(unidades.flatMap((u) => u.setores.map((s) => s.nome)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return (
    <>
      {/* Rascunho de cadastro de participante: esta tela não guarda dados de ninguém no aparelho. */}
      <LimparRascunho chave={chaveRascunhoParticipante(id)} />
      <PresencaAutoatendimento
        visitaId={id}
        exigeAssinatura={contrato?.nivel === "assinado" && ehPresencial(v.tipo)}
        exigeCpf={!!contrato?.exigeCpf}
        setores={setores}
        setorVisita={v.setorNome === "—" ? "" : v.setorNome}
        presentes={v.presencas.length}
        exigeParticipantes={exigeParticipantes(v.tipo)}
        proximaRota={`/tecnico/visita/${id}`}
        exigeLogin={exigeLogin}
        modoTecnico={modoTecnico}
        tokenTecnico={modoTecnico ? token : null}
      />
    </>
  );
}
