import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/dal";
import { buscarVisita } from "@/lib/repo/visitas";
import { buscarContrato } from "@/lib/repo/contratos";
import { chaveRascunhoParticipante, ehMembroDaVisita, exigeAssinaturaNaPresenca, exigeLoginNaPresenca, exigeParticipantes } from "@/lib/regras-visita";
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
  // Qualquer técnico da visita (principal ou convidado) registra presença; encerrada não recebe mais.
  if (!v || !usuario || !ehMembroDaVisita(v, usuario.id)) notFound();
  if (v.status !== "em_andamento") redirect(`/tecnico/visita/${id}`);
  const contrato = await buscarContrato(v.contratoId);
  // Login do participante no Saúde: só quando o contrato marca "login" (e o sistema tem login). O técnico abre o "modo sem login" por um link com token assinado.
  const exigeLogin = !!contrato && exigeLoginNaPresenca(contrato.nivel, v.tipos) && !!(await configLoginDoSistema(contrato.sistemaDoClienteId));
  const token = typeof sp.tecnico === "string" ? sp.tecnico : "";
  const modoTecnico = exigeLogin && (await conferirProva(token, { finalidade: "sem_login", visitaId: id }));
  return (
    <>
      {/* Rascunho de cadastro de participante: esta tela não guarda dados de ninguém no aparelho. */}
      <LimparRascunho chave={chaveRascunhoParticipante(id)} />
      <PresencaAutoatendimento
        visitaId={id}
        exigeAssinatura={exigeAssinaturaNaPresenca(contrato?.nivel, v.tipos)}
        exigeCpf={!!contrato?.exigeCpf}
        presentes={v.presencas.length}
        exigeParticipantes={exigeParticipantes(v.tipos)}
        proximaRota={`/tecnico/visita/${id}`}
        exigeLogin={exigeLogin}
        modoTecnico={modoTecnico}
        tokenTecnico={modoTecnico ? token : null}
      />
    </>
  );
}
