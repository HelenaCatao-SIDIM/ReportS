/* eslint-disable @next/next/no-img-element -- foto do storage */
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, LogOut, MapPin, Timer } from "lucide-react";
import { getUsuarioAtual } from "@/lib/dal";
import { buscarVisita, type VisitaDetalhada } from "@/lib/repo/visitas";
import { listarTemas } from "@/lib/repo/temas";
import { listarUnidades } from "@/lib/repo/clientes";
import { buscarContrato } from "@/lib/repo/contratos";
import { formatarData, formatarDataHora, formatarHora } from "@/lib/datas";
import { ehPresencial, rotuloTipo } from "@/lib/visitas";
import { chaveRascunho, chaveRascunhoCheckin, chaveRascunhoParticipante, chaveRascunhoTema, exigeParticipantes } from "@/lib/regras-visita";
import { LimparRascunho } from "@/components/tecnico/limpar-rascunho";
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
import { TemasVisita } from "./temas-visita";
import { FotosExtras } from "./fotos-extras";
import { ParticipantesVisita } from "./participantes-visita";

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
  // O técnico só vê as próprias visitas.
  if (!v || !usuario || v.tecnicoId !== usuario.id) notFound();
  agendarCepPendente(v, await horaDoServidor());
  return (
    <>
      <AtualizarEnquantoPendente pendente={cepEmAndamento(v)} />
      {v.status === "em_andamento" ? <EmAndamento v={v} /> : <Leitura v={v} acabouDeEncerrar={sp.ok === "encerrada"} />}
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
          <div className="truncate text-sm text-muted-foreground">
            {v.unidadeNome} · {v.setorNome}
          </div>
          <div className="text-sm text-muted-foreground">{rotuloTipo(v.tipo)}</div>
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

async function EmAndamento({ v }: { v: VisitaDetalhada }) {
  const [todosTemas, contrato, unidades] = await Promise.all([listarTemas(), buscarContrato(v.contratoId), listarUnidades(v.clienteId)]);
  // Só os temas do sistema do contrato da visita.
  const temas = todosTemas.filter((t) => t.sistema === v.sistema && (t.ativo || v.temaIds.includes(t.id)));
  const setores = [...new Set(unidades.flatMap((u) => u.setores.map((s) => s.nome)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return (
    <div className="space-y-4">
      {/* O check-in já foi feito: o rascunho dele cumpriu o papel. */}
      <LimparRascunho chave={chaveRascunhoCheckin} />
      <Link href="/tecnico" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" />
        Início
      </Link>
      <Cabecalho v={v} />
      <TemasVisita visitaId={v.id} temas={temas} inicial={v.temaIds} adicionalInicial={v.temaAdicional} />
      <FotosExtras visitaId={v.id} fotos={v.fotosExtras} />
      <ParticipantesVisita
        visitaId={v.id}
        presencas={v.presencas}
        clienteNome={v.clienteNome}
        exigeAssinatura={contrato?.nivel === "assinado" && ehPresencial(v.tipo)}
        exigeCpf={!!contrato?.exigeCpf}
        setores={setores}
        setorVisita={v.setorNome === "—" ? "" : v.setorNome}
        ehTreinamento={v.tipo === "treinamento" || v.tipo === "treinamento_online"}
      />
      <div className="space-y-2 pb-2">
        <Button nativeButton={false} render={<Link href={`/tecnico/visita/${v.id}/checkout`} />} className="h-12 w-full text-base">
          <LogOut />
          Fazer check-out
        </Button>
        {exigeParticipantes(v.tipo) && v.presencas.length === 0 && (
          <p className="text-center text-xs text-amber-700">Registre ao menos um participante antes do check-out.</p>
        )}
      </div>
    </div>
  );
}

function Leitura({ v, acabouDeEncerrar }: { v: VisitaDetalhada; acabouDeEncerrar: boolean }) {
  return (
    <div className="space-y-4">
      <LimparRascunho chave={[chaveRascunho(v.id), chaveRascunhoParticipante(v.id), chaveRascunhoTema(v.id)]} />
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
