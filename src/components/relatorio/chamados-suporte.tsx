import Link from "next/link";
import { ChevronDown, Headset } from "lucide-react";
import type { ResumoSuporte, TipoRelatorioAtendimentos } from "@/lib/types";
import { formatarDataHora } from "@/lib/datas";
import { formatarTempo, indicadores, linhaDoAtendimento, ordenarPorAbertura, tabulacoes } from "@/lib/chamados";
import { rotuloTipoRelatorioAtendimentos } from "@/lib/contratos";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Só para a Administração: por quais nomes do cliente os chamados foram buscados, para conferir quando o resultado parece errado. */
function NomesBuscados({ nomes, aviso = false }: { nomes?: string[]; aviso?: boolean }) {
  if (!nomes?.length) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Atendimentos buscados pelo nome: {nomes.join(" · ")}.{" "}
      {aviso && "Se o Fortics grava este cliente com outro nome, cadastre-o em Clientes → editar → “Outros nomes nos atendimentos”. "}
    </p>
  );
}

const CORES = {
  azul: "border-t-blue-600 text-blue-700",
  verde: "border-t-teal-600 text-teal-700",
  roxo: "border-t-violet-600 text-violet-700",
  ambar: "border-t-amber-600 text-amber-700",
} as const;

/** Um número do painel: rótulo, valor grande e uma frase curta. */
function Indicador({ cor, rotulo, valor, legenda }: { cor: keyof typeof CORES; rotulo: string; valor: string; legenda: string }) {
  return (
    <div className={cn("rounded-lg border border-t-4 bg-card px-3 pb-2.5 pt-2", CORES[cor])}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</div>
      <div className="mt-0.5 text-3xl font-bold leading-tight tabular-nums">{valor}</div>
      <div className="text-xs text-muted-foreground">{legenda}</div>
    </div>
  );
}

/** Contagem por tabulação (o motivo de encerramento): barra proporcional, quantidade em destaque e uma linha fina entre as linhas. */
function PorTabulacao({ r }: { r: ResumoSuporte }) {
  const linhas = tabulacoes(r);
  if (!linhas.length) return null;
  const maior = Math.max(...linhas.map((l) => l.quantidade), 1);
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-baseline justify-between bg-muted/60 px-3 py-2 text-xs">
        <span className="font-semibold uppercase tracking-wide text-muted-foreground">Por tabulação</span>
        <span className="text-muted-foreground">{r.totalAbertosEFechados} atendimentos</span>
      </div>
      <ul>
        {linhas.map((l) => (
          <li key={l.nome} className="grid grid-cols-[minmax(0,1fr)_2.5rem_2.5rem] items-center gap-x-3 gap-y-1.5 border-t px-3 py-2.5 first:border-t-0 sm:grid-cols-[14rem_minmax(0,1fr)_2.5rem_2.5rem]">
            <span className="min-w-0 text-sm">{l.nome}</span>
            <span className="order-last col-span-3 h-2.5 overflow-hidden rounded-full bg-muted sm:order-none sm:col-span-1">
              <span className={cn("block h-full rounded-full", l.neutra ? "bg-slate-400" : "bg-blue-600")} style={{ width: `${(l.quantidade / maior) * 100}%` }} />
            </span>
            <span className="text-right text-lg font-bold tabular-nums">{l.quantidade}</span>
            <span className="text-right text-xs text-muted-foreground tabular-nums">{l.percentual}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Bloco "Atendimentos do suporte" do relatório: painel de indicadores e contagem por tabulação.
 * `publico="aprovador"`: só o painel (a lista com nomes fica no PDF e na Administração); sem vínculo ou sem conexão com o n8n,
 * não mostra nada para o aprovador.
 */
export function ChamadosSuporte({
  resumo: r,
  publico,
  tipo,
}: {
  resumo: ResumoSuporte;
  publico: "administracao" | "aprovador";
  /** Tipo do relatório de atendimentos do contrato (só a Administração vê o selo). */
  tipo?: TipoRelatorioAtendimentos;
}) {
  if (publico === "aprovador" && (r.situacao === "sem_vinculo" || r.situacao === "nao_configurado")) return null;

  const ind = indicadores(r);
  let corpo: React.ReactNode;
  if (r.situacao === "sem_vinculo") {
    corpo = <p className="text-sm text-muted-foreground">Cliente sem nome no cadastro: não há pelo que buscar os atendimentos.</p>;
  } else if (r.situacao === "nao_configurado") {
    corpo = (
      <p className="text-sm text-muted-foreground">
        A conexão com o n8n ainda não foi configurada, então os atendimentos não aparecem no relatório. Configure em{" "}
        <Link href="/admin/configuracoes" className="font-medium text-primary hover:underline">
          Administração → Configurações
        </Link>
        .
      </p>
    );
  } else if (r.situacao === "indisponivel") {
    corpo = <p className="text-sm text-muted-foreground">Dados de suporte indisponíveis no momento.</p>;
  } else if (r.totalAbertosEFechados === 0) {
    corpo = (
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Nenhum atendimento no período.</p>
        {publico === "administracao" && <NomesBuscados nomes={r.nomesBuscados} aviso />}
      </div>
    );
  } else {
    const lista = ordenarPorAbertura(r.chamados);
    corpo = (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <Indicador cor="azul" rotulo="Atendimentos" valor={String(ind.total)} legenda="abertos e fechados no período" />
          <Indicador cor="verde" rotulo="Espera média" valor={formatarTempo(ind.esperaMediaMin)} legenda="até o atendente responder" />
          <Indicador cor="roxo" rotulo="Atendimento médio" valor={formatarTempo(ind.atendimentoMedioMin)} legenda="por atendimento" />
          <Indicador cor="ambar" rotulo="Tempo total dedicado" valor={formatarTempo(ind.tempoTotalMin)} legenda="soma de todos os atendimentos" />
        </div>
        {publico === "administracao" && <NomesBuscados nomes={r.nomesBuscados} />}
        {publico === "administracao" && r.sistemaFiltro !== undefined && (
          <p className="text-xs text-muted-foreground">
            {r.sistemaFiltro
              ? `Só os atendimentos do sistema ${r.sistemaFiltro} no Fortics.`
              : "Todos os sistemas do cliente: este sistema não tem “Nome no Fortics” cadastrado no SINC (Configurações > Sistemas). Se o cliente tem mais de um sistema, o número se repete nos relatórios de cada um."}
          </p>
        )}
        <PorTabulacao r={r} />
        {publico === "administracao" && lista.length > 0 && (
          <details className="group rounded-lg border">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium">
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-not-open:-rotate-90" />
              Ver os {lista.length} atendimentos
              <span className="font-normal text-muted-foreground">
                · a lista {tipo === "analitico" ? "sai no PDF (contrato analítico)" : "não sai no PDF (contrato sintético)"}
              </span>
            </summary>
            <div className="overflow-x-auto border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-3">Data e horário</TableHead>
                    <TableHead>Tempo</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Técnico</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead className="pr-3">Tabulação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((ch) => {
                    const l = linhaDoAtendimento(ch);
                    return (
                      <TableRow key={ch.protocolo}>
                        <TableCell className="whitespace-nowrap pl-3 text-xs">
                          {l.dia}
                          <div className="text-muted-foreground">{l.horario}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium">{l.tempo}</TableCell>
                        <TableCell>{l.solicitante}</TableCell>
                        <TableCell>{l.tecnico}</TableCell>
                        <TableCell>{l.assunto}</TableCell>
                        <TableCell className="pr-3">{l.tabulacao}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </details>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Headset className="size-4" />
          Atendimentos do suporte
          {publico === "administracao" && tipo && <span className="rounded-full border px-2 py-0.5 text-xs font-normal text-muted-foreground">Relatório {rotuloTipoRelatorioAtendimentos(tipo).toLowerCase()}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {corpo}
        {r.situacao === "ok" && <p className="text-xs text-muted-foreground">Fonte: atendimentos do suporte (Fortics), consultados em {formatarDataHora(r.consultadoEm)}.</p>}
      </CardContent>
    </Card>
  );
}
