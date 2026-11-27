/* eslint-disable @next/next/no-img-element -- foto do storage */
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, LogOut, MapPin, Timer, Users } from "lucide-react";
import { getUsuarioAtual } from "@/lib/dal";
import { buscarVisita, type VisitaDetalhada } from "@/lib/repo/visitas";
import { listarTemas } from "@/lib/repo/temas";
import { listarEquipes } from "@/lib/repo/equipes";
import { buscarContrato } from "@/lib/repo/contratos";
import { formatarData, formatarDataHora, formatarHora } from "@/lib/datas";
import { rotuloAtendidos, rotuloTipos } from "@/lib/visitas";
import {
  chaveRascunho,
  chaveRascunhoCheckin,
  chaveRascunhoParticipante,
  chaveRascunhoTema,
  ehMembroDaVisita,
  equipesDaVisita,
  exigeAssinaturaNaPresenca,
  exigeLoginNaPresenca,
  exigeParticipantes,
  sugereTemasPorEquipe,
} from "@/lib/regras-visita";
import { LimparRascunho } from "@/components/tecnico/limpar-rascunho";
import { configLoginDoSistema } from "@/lib/repo/presenca-login";
import { assinarProva } from "@/lib/saude-login";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DetalheVisita } from "@/components/visita/detalhe-visita";
import { LocalVisita } from "@/components/visita/local-visita";
import { localizacaoPorCep } from "@/lib/config";
import { agendarCepPendente, cepEmAndamento } from "@/lib/cep-visitas";
import { AtualizarEnquantoPendente } from "@/components/visita/atualizar-enquanto-pendente";
import { horaDoServidor } from "@/lib/agora";
import { SelosVisita } from "@/components/visita/selos";
import { Card } from "@/components/ui/card";
import { TemasVisita, type PorEquipe } from "./temas-visita";
import { FotosExtras } from "./fotos-extras";
import { ParticipantesVisita } from "./participantes-visita";
import { AnotacoesVisita } from "./anotacoes-visita";

export default function VisitaTecnicoPage({ params, searchParams }: PageProps<"/tecnico/visita/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Conteudo params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Conteudo({ params, searchParams }: Pick<PageProps<"/tecnico/visita/[id]">, "params" | "searchParams">) {
  const [{ id }, sp, usuario] = await Promise.all([params, searchParams, getUsuarioAtual()]);
  const v = await buscarVisita(id);
  // Qualquer técnico da visita (principal ou convidado) acessa; os demais, não.
  if (!v || !usuario || !ehMembroDaVisita(v, usuario.id)) notFound();
  agendarCepPendente(v, await horaDoServidor());
  return (
    <>
      <AtualizarEnquantoPendente pendente={cepEmAndamento(v)} />
      {v.status === "em_andamento" ? <EmAndamento v={v} tecnicoId={usuario.id} /> : <Leitura v={v} tecnicoId={usuario.id} acabouDeEncerrar={sp.ok === "encerrada"} />}
    </>
  );
}

function Cabecalho({ v }: { v: VisitaDetalhada }) {
  const foto = v.fotoAmbiente ?? v.printTela;
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex gap-3 p-4">
        {foto && <img src={foto.url} alt="Foto do check-in" className="size-20 shrink-0 rounded-lg border object-cover" />}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Timer className="size-3.5" />
            Em andamento desde {formatarHora(v.entrada)}
          </div>
          <div className="truncate text-base font-semibold">
            {v.clienteNome}
            <span className="font-normal text-muted-foreground"> · {v.sistemaNome}</span>
          </div>
          <div className="text-sm break-words text-muted-foreground">
            {v.unidadeNome} · {rotuloAtendidos(v)}
          </div>
          <div className="text-sm text-muted-foreground">{rotuloTipos(v.tipos)}</div>
          {v.checkin &&
            (localizacaoPorCep() ? (
              <div className="mt-0.5 flex text-[11px] text-muted-foreground">
                <LocalVisita local={v.checkin} compacto />
              </div>
            ) : (
              <div className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                <MapPin className="size-3" />
                {v.checkin.latitude.toFixed(5)}, {v.checkin.longitude.toFixed(5)}
              </div>
            ))}
        </div>
      </div>
    </Card>
  );
}

async function EmAndamento({ v, tecnicoId }: { v: VisitaDetalhada; tecnicoId: string }) {
  const minha = v.tecnicos?.find((t) => t.tecnicoId === tecnicoId) ?? null;
  const outros = (v.tecnicos ?? []).filter((t) => t.tecnicoId !== tecnicoId);
  const anotacoes = minha ?? { observacoes: v.observacoes, pendencias: v.pendencias, proximosPassos: v.proximosPassos };
  const [todosTemas, contrato, equipes] = await Promise.all([
    listarTemas(),
    buscarContrato(v.contratoId),
    listarEquipes(),
  ]);
  // Só os temas do sistema do contrato da visita.
  const temas = todosTemas.filter((t) => t.sistema === v.sistema && (t.ativo || v.temaIds.includes(t.id)));
  // Implantação e treinamentos: o técnico marca as equipes e recebe os temas mínimos delas (do sistema do contrato) como sugestão.
  const porEquipe: PorEquipe | undefined = sugereTemasPorEquipe(v.tipos)
    ? {
        equipes: equipesDaVisita(equipes, v.equipeIds).map(({ id, nome, temaIds }) => ({ id, nome, temaIds })),
        inicial: v.equipeIds,
      }
    : undefined;
  // Login só quando o contrato marca "login" (e o sistema tem login). Aí o técnico tem o atalho "registrar sem login" (token assinado, 30 min).
  const loginLigado = !!contrato && exigeLoginNaPresenca(contrato.nivel, v.tipos) && !!(await configLoginDoSistema(contrato.sistemaDoClienteId));
  const semLoginHref = loginLigado ? `/tecnico/visita/${v.id}/presenca?tecnico=${await assinarProva({ finalidade: "sem_login", visitaId: v.id }, 30)}` : null;
  return (
    <div className="space-y-4">
      {/* O check-in já foi feito: o rascunho dele cumpriu o papel. */}
      <LimparRascunho chave={chaveRascunhoCheckin} />
      <Link href="/tecnico" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" />
        Início
      </Link>
      <Cabecalho v={v} />
      {v.conjunta && (
        <Card className="gap-1 border-primary/30 bg-primary/5 py-3">
          <div className="flex items-center gap-1.5 px-4 text-sm font-medium text-primary">
            <Users className="size-4" />
            Visita conjunta
          </div>
          <p className="px-4 text-xs">
            Você está preenchendo como <span className="font-semibold text-primary">{minha?.nome ?? "—"}</span>.
          </p>
          <ul className="space-y-0.5 px-4 text-xs text-muted-foreground">
            {outros.map((t) => (
              <li key={t.tecnicoId}>
                {t.nome} ·{" "}
                {t.estado === "convidado" ? "ainda não fez check-in" : t.estado === "encerrado" ? "já fez o check-out" : "na visita"}
              </li>
            ))}
          </ul>
          <p className="px-4 text-xs text-muted-foreground">Temas e participantes são compartilhados; as suas anotações e fotos extras são só suas.</p>
        </Card>
      )}
      <TemasVisita visitaId={v.id} temas={temas} inicial={v.temaIds} adicionalInicial={v.temaAdicional} porEquipe={porEquipe} />
      <AnotacoesVisita visitaId={v.id} tecnicoId={tecnicoId} inicial={{ observacoes: anotacoes.observacoes, pendencias: anotacoes.pendencias, proximosPassos: anotacoes.proximosPassos }} />
      <FotosExtras visitaId={v.id} fotos={minha?.fotosExtras ?? v.fotosExtras} />
      <ParticipantesVisita
        visitaId={v.id}
        presencas={v.presencas}
        exigeAssinatura={exigeAssinaturaNaPresenca(contrato?.nivel, v.tipos)}
        ehTreinamento={v.tipos.includes("treinamento") || v.tipos.includes("treinamento_online")}
        semLoginHref={semLoginHref}
      />
      <div className="space-y-2 pb-2">
        {minha && minha.saida ? (
          <p className="rounded-lg border bg-muted/40 p-3 text-center text-sm text-muted-foreground">
            Você já fez o seu check-out. A visita encerra quando o último técnico sair.
          </p>
        ) : (
          <>
            <Button nativeButton={false} render={<Link href={`/tecnico/visita/${v.id}/checkout`} />} className="h-12 w-full text-base">
              <LogOut />
              Fazer check-out
            </Button>
            {exigeParticipantes(v.tipos) && v.presencas.length === 0 && (
              <p className="text-center text-xs text-amber-700">Registre ao menos um participante antes do check-out.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Leitura({ v, tecnicoId, acabouDeEncerrar }: { v: VisitaDetalhada; tecnicoId: string; acabouDeEncerrar: boolean }) {
  return (
    <div className="space-y-4">
      <LimparRascunho chave={[chaveRascunho(v.id, tecnicoId), chaveRascunhoParticipante(v.id), chaveRascunhoTema(v.id)]} />
      {acabouDeEncerrar && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
          <CheckCircle2 />
          <AlertDescription className="text-emerald-800">
            Check-out feito às {v.saida ? formatarHora(v.saida) : "—"}. Visita encerrada.{" "}
            <Link href="/tecnico" className="font-medium underline">
              Voltar ao início
            </Link>
          </AlertDescription>
        </Alert>
      )}
      <Link href="/tecnico/visitas" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" />
        Minhas visitas
      </Link>
      <div>
        <h1 className="text-xl font-semibold">
          {v.clienteNome}
          <span className="font-normal text-muted-foreground"> · {v.sistemaNome}</span>
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {formatarData(v.entrada)}
          <SelosVisita visita={v} />
        </p>
        {v.saida && <p className="mt-1 text-xs text-muted-foreground">Encerrada em {formatarDataHora(v.saida)}. Correções só pela coordenação.</p>}
      </div>
      <DetalheVisita visita={v} cpf="mascarado" selos />
    </div>
  );
}
