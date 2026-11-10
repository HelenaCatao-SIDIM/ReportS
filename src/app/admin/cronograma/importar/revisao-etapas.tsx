"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, CircleSlash, Loader2, TriangleAlert } from "lucide-react";
import {
  etapasDaLinha,
  linhaResolvida,
  perguntasDaPlanilha,
  podeConfirmar,
  proximoDaFila,
  resumir,
  rotuloContrato,
  type ContextoImportacao,
  type ContratoCtx,
  type Decisao,
  type Decisoes,
  type LinhaResolvida,
  type Pergunta,
} from "@/lib/importar-cronograma";
import { formatarDataCurta, rotuloTipo, TIPOS_VISITA } from "@/lib/visitas";
import type { TipoVisita } from "@/lib/types";
import { cn } from "@/lib/utils";
import { selectClass } from "@/components/form/campo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const semLinha = <T,>(r: Record<number, T>, linha: number) => Object.fromEntries(Object.entries(r).filter(([k]) => Number(k) !== linha)) as Record<number, T>;
const chavePergunta = (p: Pick<Pergunta, "campo" | "chave">) => `${p.campo}|${p.chave}`;

function Novo() {
  return (
    <Badge variant="outline" className="ml-1.5 border-sky-300 bg-sky-50 text-sky-800">
      novo
    </Badge>
  );
}

/** Uma linha do item: o nome do campo à esquerda e o valor (ou a pergunta) à direita. */
function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-4" data-testid={`campo-${rotulo.toLowerCase()}`}>
      <div className="w-36 shrink-0 pt-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">{rotulo}</div>
      <div className="min-w-0 flex-1 text-sm">{children}</div>
    </div>
  );
}

function PerguntaCard({ p, linhaAtual, podeCadastrar, onDecidir }: { p: Pergunta; linhaAtual: number; podeCadastrar: boolean; onDecidir: (d: Decisao | null) => void }) {
  const decisao = p.decisao;
  const ordenadas = [...p.existentes].sort((a, b) => Number(b.id === p.sugerido) - Number(a.id === p.sugerido));
  const outras = [...new Set(p.linhas)].filter((n) => n !== linhaAtual);
  return (
    <div data-testid="pergunta" className={cn("rounded-lg border p-3", decisao ? "border-emerald-300 bg-emerald-50/50" : "border-amber-300 bg-amber-50")}>
      <div>
        O estabelecimento <b>“{p.nome}”</b> não existe em <b>{p.onde}</b>.
        {outras.length > 0 && <span className="text-muted-foreground"> A resposta vale também para {outras.length === 1 ? "a linha" : "as linhas"} {outras.join(", ")}.</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant={decisao?.acao === "cadastrar" ? "default" : "outline"} disabled={!podeCadastrar} onClick={() => onDecidir({ acao: "cadastrar" })}>
          Cadastrar “{p.nome}”
        </Button>
        <span className="text-xs text-muted-foreground">ou</span>
        <select
          aria-label={`Trocar “${p.nome}” por um existente`}
          value={decisao?.acao === "usar" ? decisao.id : ""}
          onChange={(ev) => onDecidir(ev.target.value ? { acao: "usar", id: ev.target.value } : null)}
          className={cn(selectClass, "w-auto min-w-56 bg-background", decisao?.acao === "usar" && "border-emerald-400")}
        >
          <option value="">Alterar para um existente…</option>
          {ordenadas.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
              {o.id === p.sugerido ? " (parecido)" : ""}
            </option>
          ))}
        </select>
      </div>
      {!podeCadastrar && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Você não tem permissão para cadastrar estabelecimentos (reports.clientes.cadastrar): escolha um existente ou pule o item.
        </p>
      )}
      {decisao?.acao === "cadastrar" && <p className="mt-1.5 text-xs text-muted-foreground">Será criado só com o nome (raio de 50 m, sem endereço nem coordenadas). Complete depois em Clientes.</p>}
    </div>
  );
}

interface ItemProps {
  l: LinhaResolvida;
  /** Contratos que o usuário pode escolher (guardados da primeira análise, porque depois de escolher a lista some). */
  opcoesContrato: ContratoCtx[];
  contexto: ContextoImportacao;
  dec: Decisoes;
  alterar: (parcial: Partial<Decisoes>) => void;
  perguntasDaPlanilha: Map<string, Pergunta>;
  podeCadastrar: boolean;
}

/** Um item por vez: mostra os campos já resolvidos e o primeiro que falta; os seguintes aparecem quando este for resolvido. */
function ItemEmEtapas({ l, opcoesContrato, contexto, dec, alterar, perguntasDaPlanilha: planilha, podeCadastrar }: ItemProps) {
  const b = l.bruta;
  const e = etapasDaLinha(l);
  const aparece = (c: (typeof e.visiveis)[number]) => e.visiveis.includes(c);

  function decidir(p: Pergunta, d: Decisao | null) {
    const tabela = { ...dec.estab };
    if (d) tabela[p.chave] = d;
    else delete tabela[p.chave];
    alterar({ estab: tabela });
  }
  const pergunta = (campo: Pergunta["campo"]) => {
    const p = l.perguntas.find((x) => x.campo === campo);
    return p ? (planilha.get(chavePergunta(p)) ?? p) : undefined;
  };
  const pEstab = pergunta("estabelecimento");
  // Equipes escolhidas na tela para esta linha (quando a planilha trouxe uma equipe que não existe).
  const escolhidas = dec.equipes[b.linha];
  const alternarEquipe = (id: string) => {
    const atual = escolhidas ?? [];
    const novas = atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id];
    alterar({ equipes: { ...dec.equipes, [b.linha]: novas } });
  };

  return (
    <div className="space-y-4" data-testid="item">
      <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground" data-testid="linha-planilha">
        Na planilha, linha {b.linha}: {[b.cliente, b.sistema, b.estabelecimento, b.equipesTexto, b.atividadeTexto, b.prazo ? formatarDataCurta(b.prazo) : b.prazoTexto].map((x) => x || "—").join(" · ")}
        {b.horario && ` · ${b.horario}`}
      </p>

      <div className="space-y-4">
        {aparece("contrato") && (
          <Campo rotulo="Contrato">
            {l.contrato && !dec.contrato[b.linha] ? (
              <span className="font-medium">{rotuloContrato(l.contrato, contexto.contratos)}</span>
            ) : (
              <div className="space-y-1.5">
                {!l.contrato && l.problemaDoCampo.contrato && <p className="text-destructive">{l.problemaDoCampo.contrato}</p>}
                <select
                  aria-label={`Contrato da linha ${b.linha}`}
                  value={dec.contrato[b.linha] ?? ""}
                  onChange={(ev) => alterar({ contrato: ev.target.value ? { ...dec.contrato, [b.linha]: ev.target.value } : semLinha(dec.contrato, b.linha) })}
                  className={cn(selectClass, "w-auto min-w-64 bg-background", l.contrato && "border-emerald-400")}
                >
                  <option value="">Escolha o contrato…</option>
                  {opcoesContrato.map((c) => (
                    <option key={c.id} value={c.id}>
                      {rotuloContrato(c, contexto.contratos)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </Campo>
        )}

        {aparece("estabelecimento") && (
          <Campo rotulo="Estabelecimento">
            {pEstab ? (
              <PerguntaCard p={pEstab} linhaAtual={b.linha} podeCadastrar={podeCadastrar} onDecidir={(d) => decidir(pEstab, d)} />
            ) : l.unidade ? (
              <>
                {l.unidade.nome}
                {l.unidade.tipo === "nova" && <Novo />}
              </>
            ) : (
              <span className="text-muted-foreground">{b.estabelecimento || "—"}</span>
            )}
          </Campo>
        )}

        {aparece("equipes") && (
          <Campo rotulo="Equipes">
            {l.equipes && !escolhidas ? (
              l.equipes.length ? (
                l.equipes.map((x) => x.nome).join(", ")
              ) : (
                <span className="text-muted-foreground">Todas as equipes</span>
              )
            ) : (
              <div className="space-y-1.5">
                {l.problemaDoCampo.equipes && <p className="text-destructive">{l.problemaDoCampo.equipes}</p>}
                {contexto.equipes.length === 0 ? (
                  <p className="text-muted-foreground">Nenhuma equipe ativa cadastrada.</p>
                ) : (
                  <div className="grid gap-1.5 rounded-lg border bg-background p-3 sm:grid-cols-2" data-testid="escolha-equipes">
                    {contexto.equipes.map((x) => (
                      <label key={x.id} className="flex items-center gap-2">
                        <input type="checkbox" className="size-4 accent-primary" checked={(escolhidas ?? []).includes(x.id)} onChange={() => alternarEquipe(x.id)} />
                        {x.nome}
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Sem nenhuma marcada, o item vale para todas as equipes.</p>
              </div>
            )}
          </Campo>
        )}

        {aparece("atividade") && (
          <Campo rotulo="Atividade">
            {b.atividade && !dec.atividade[b.linha] ? (
              rotuloTipo(b.atividade)
            ) : (
              <div className="space-y-1.5">
                {!l.atividade && l.problemaDoCampo.atividade && <p className="text-destructive">{l.problemaDoCampo.atividade}</p>}
                <select
                  aria-label={`Atividade da linha ${b.linha}`}
                  value={dec.atividade[b.linha] ?? ""}
                  onChange={(ev) => alterar({ atividade: ev.target.value ? { ...dec.atividade, [b.linha]: ev.target.value as TipoVisita } : semLinha(dec.atividade, b.linha) })}
                  className={cn(selectClass, "w-auto min-w-56 bg-background", l.atividade && "border-emerald-400")}
                >
                  <option value="">Escolha a atividade…</option>
                  {TIPOS_VISITA.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </Campo>
        )}

        {aparece("prazo") && (
          <Campo rotulo="Prazo">
            {b.prazo && dec.prazo[b.linha] === undefined ? (
              formatarDataCurta(b.prazo)
            ) : (
              <div className="space-y-1.5">
                {l.problemaDoCampo.prazo && <p className="text-destructive">{l.problemaDoCampo.prazo}</p>}
                <Input
                  aria-label={`Prazo da linha ${b.linha}`}
                  type="date"
                  value={dec.prazo[b.linha] ?? ""}
                  onChange={(ev) => alterar({ prazo: { ...dec.prazo, [b.linha]: ev.target.value } })}
                  className={cn("h-9 w-44 bg-background", !l.problemaDoCampo.prazo && "border-emerald-400")}
                />
              </div>
            )}
          </Campo>
        )}

        {aparece("prazo") && b.horario && <Campo rotulo="Horário">{b.horario}</Campo>}
      </div>

      {e.semConserto.length > 0 && l.situacao !== "pulada" && (
        <Alert variant="destructive" data-testid="sem-conserto">
          <AlertCircle />
          <AlertDescription>
            {e.semConserto.map((m) => (
              <div key={m}>{m}</div>
            ))}
            <div className="mt-1">Isso se corrige na planilha. Pule este item, ou envie a planilha de novo depois de ajustar.</div>
          </AlertDescription>
        </Alert>
      )}
      {l.situacao === "pronta" && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700" data-testid="item-resolvido">
          <CheckCircle2 className="size-4" />
          Tudo certo: este item será criado.
        </p>
      )}
      {l.situacao === "duplicada" && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="item-resolvido">
          <CircleSlash className="size-4" />
          Este item não será importado. {l.motivoDuplicada}
        </p>
      )}
      {l.situacao === "pulada" && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="item-resolvido">
          <CircleSlash className="size-4" />
          Você pulou este item: ele não será importado.
        </p>
      )}
    </div>
  );
}

const COR_PONTO: Record<LinhaResolvida["situacao"], string> = {
  pronta: "border-emerald-600 bg-emerald-500",
  duplicada: "border-muted-foreground/50 bg-muted",
  pulada: "border-muted-foreground/50 bg-muted",
  decidir: "border-amber-600 bg-amber-300",
  erro: "border-destructive bg-destructive/50",
};

function Pontos({ fila, passo, irPara }: { fila: LinhaResolvida[]; passo: number; irPara: (n: number) => void }) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="Itens que precisam de você" data-testid="pontos">
      {fila.map((l, i) => (
        <li key={l.bruta.linha}>
          <button
            type="button"
            onClick={() => irPara(i)}
            aria-label={`Ir ao item ${i + 1} (linha ${l.bruta.linha})`}
            aria-current={i === passo ? "step" : undefined}
            data-situacao={l.situacao}
            className={cn("block size-3.5 rounded-full border transition", COR_PONTO[l.situacao], i === passo && "ring-2 ring-primary ring-offset-2")}
          />
        </li>
      ))}
      <li>
        <button
          type="button"
          onClick={() => irPara(fila.length)}
          aria-current={passo === fila.length ? "step" : undefined}
          className={cn("ml-1 rounded-full border px-2 py-0.5 text-xs transition hover:bg-muted", passo === fila.length && "border-primary bg-primary text-primary-foreground hover:bg-primary")}
        >
          Resumo
        </button>
      </li>
    </ol>
  );
}

const SITUACAO_RESUMO: Record<LinhaResolvida["situacao"], { rotulo: string; classe: string }> = {
  pronta: { rotulo: "Será criada", classe: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  decidir: { rotulo: "Falta decidir", classe: "border-amber-300 bg-amber-50 text-amber-900" },
  erro: { rotulo: "Erro", classe: "border-destructive/40 bg-destructive/10 text-destructive" },
  duplicada: { rotulo: "Ignorada", classe: "text-muted-foreground" },
  pulada: { rotulo: "Pulada", classe: "text-muted-foreground" },
};

export interface RevisaoProps {
  arquivo: string;
  avisos: string[];
  contexto: ContextoImportacao;
  podeCadastrar: boolean;
  /** Os itens que precisavam do usuário na primeira análise, na ordem da planilha. A lista não muda enquanto ele responde. */
  filaInicial: LinhaResolvida[];
  resolvidas: LinhaResolvida[];
  dec: Decisoes;
  alterar: (parcial: Partial<Decisoes>) => void;
  passo: number;
  irPara: (n: number) => void;
  pendente: boolean;
  errosGravacao: { linha: number; mensagem: string }[] | null;
  onConfirmar: () => void;
  onRecomecar: () => void;
}

export function RevisaoEmEtapas(props: RevisaoProps) {
  const { arquivo, avisos, contexto, podeCadastrar, filaInicial, resolvidas, dec, alterar, passo, irPara, pendente, errosGravacao, onConfirmar, onRecomecar } = props;
  const resumo = useMemo(() => resumir(resolvidas), [resolvidas]);
  const planilha = useMemo(() => new Map(perguntasDaPlanilha(resolvidas).map((p) => [chavePergunta(p), p])), [resolvidas]);
  const porLinha = useMemo(() => new Map(resolvidas.map((l) => [l.bruta.linha, l])), [resolvidas]);
  // A mesma fila de antes, com a situação de agora de cada item.
  const fila = filaInicial.map((f) => porLinha.get(f.bruta.linha) ?? f);
  const noResumo = passo >= fila.length;
  const faltam = resumo.decidir + resumo.erro;

  const titulo = useRef<HTMLHeadingElement>(null);
  const primeiraVez = useRef(true);
  useEffect(() => {
    // Ao mudar de etapa, o foco vai para o título dela (leitor de tela anuncia; teclado continua dali).
    if (primeiraVez.current) primeiraVez.current = false;
    else titulo.current?.focus();
  }, [passo]);

  const cabecalho = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="text-sm text-muted-foreground" data-testid="cabecalho-arquivo">
        Arquivo <b className="text-foreground">{arquivo}</b>: {resumo.total} {resumo.total === 1 ? "linha" : "linhas"}
        {fila.length === 0 ? ", nenhuma precisa de você." : `, ${fila.length} ${fila.length === 1 ? "precisa" : "precisam"} de você.`}
      </div>
      <Button variant="outline" size="sm" onClick={onRecomecar}>
        Escolher outro arquivo
      </Button>
    </div>
  );

  const alertas = avisos.map((a) => (
    <Alert key={a} className="border-amber-300 bg-amber-50 text-amber-900">
      <TriangleAlert />
      <AlertDescription className="text-amber-900">{a}</AlertDescription>
    </Alert>
  ));

  // ---------- Um item por vez ----------
  if (!noResumo) {
    const l = fila[passo];
    const proximo = proximoDaFila(fila, passo);
    const resolvido = linhaResolvida(l);
    const pulada = l.situacao === "pulada";
    return (
      <div className="space-y-4">
        {cabecalho}
        {alertas}
        <Card className="gap-4 p-5" data-testid="passo-item">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 ref={titulo} tabIndex={-1} className="text-base font-semibold outline-none" data-testid="passo-titulo">
              Item {passo + 1} de {fila.length}
            </h2>
            <Pontos fila={fila} passo={passo} irPara={irPara} />
          </div>
          <ItemEmEtapas
            key={l.bruta.linha}
            l={l}
            opcoesContrato={filaInicial[passo].contratoOpcoes}
            contexto={contexto}
            dec={dec}
            alterar={alterar}
            perguntasDaPlanilha={planilha}
            podeCadastrar={podeCadastrar}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <Button variant="outline" disabled={passo === 0} onClick={() => irPara(passo - 1)}>
              <ArrowLeft />
              Anterior
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={() => alterar({ pular: pulada ? semLinha(dec.pular, l.bruta.linha) : { ...dec.pular, [l.bruta.linha]: true } })}>
                {pulada ? "Importar este item" : "Pular este item"}
              </Button>
              <Button disabled={!resolvido} onClick={() => irPara(proximo)}>
                {proximo >= fila.length ? "Ver o resumo" : "Próximo"}
                <ArrowRight />
              </Button>
            </div>
          </div>
          {!resolvido && <p className="-mt-2 text-xs text-muted-foreground">Responda o que falta acima, ou pule este item, para continuar.</p>}
        </Card>
      </div>
    );
  }

  // ---------- Resumo e confirmação ----------
  const primeiroPendente = fila.findIndex((l) => !linhaResolvida(l));
  const contadores = [
    { id: "criadas", rotulo: "Serão criadas", valor: resumo.prontas },
    { id: "faltam", rotulo: "Falta resolver", valor: faltam },
    { id: "ignoradas", rotulo: "Já existem ou se repetem", valor: resumo.duplicadas },
    { id: "puladas", rotulo: "Puladas por você", valor: resumo.puladas },
  ];
  return (
    <div className="space-y-4">
      {cabecalho}
      {alertas}
      <Card className="gap-4 p-5" data-testid="confirmacao">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 ref={titulo} tabIndex={-1} className="text-base font-semibold outline-none" data-testid="passo-titulo">
            Resumo da importação
          </h2>
          {fila.length > 0 && <Pontos fila={fila} passo={passo} irPara={irPara} />}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {contadores.map((c) => (
            <div key={c.id} className="rounded-lg border px-4 py-3">
              <div className="text-xs text-muted-foreground">{c.rotulo}</div>
              <div className="text-2xl font-semibold" data-testid={`contador-${c.id}`}>
                {c.valor}
              </div>
            </div>
          ))}
        </div>

        <div>
          <div className="mb-1 text-sm font-medium">O que vai acontecer</div>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              <b>{resumo.prontas}</b> {resumo.prontas === 1 ? "item será criado" : "itens serão criados"} no cronograma.
            </li>
            {resumo.estabelecimentosNovos.length > 0 && (
              <li>
                {resumo.estabelecimentosNovos.length} estabelecimento(s) novo(s) será(ão) cadastrado(s): {resumo.estabelecimentosNovos.map((e) => `“${e.nome}” (${e.cliente})`).join(", ")}.
              </li>
            )}
            {resumo.duplicadas > 0 && <li>{resumo.duplicadas} linha(s) não serão importadas porque o item já existe ou se repete na planilha.</li>}
            {resumo.puladas > 0 && <li>{resumo.puladas} linha(s) puladas por você.</li>}
          </ul>
        </div>

        <details open={fila.length === 0} className="rounded-lg border" data-testid="todas-as-linhas">
          <summary className="cursor-pointer px-4 py-2 text-sm font-medium">Ver todas as linhas da planilha ({resumo.total})</summary>
          <div className="overflow-x-auto border-t">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Linha</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Estabelecimento</TableHead>
                  <TableHead>Equipes</TableHead>
                  <TableHead>Atividade</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead className="pr-4">Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolvidas.map((l) => {
                  const b = l.bruta;
                  const s = SITUACAO_RESUMO[l.situacao];
                  const apagada = l.situacao === "pulada" || l.situacao === "duplicada";
                  return (
                    <TableRow key={b.linha} data-testid={`linha-${b.linha}`} className={cn(apagada && "text-muted-foreground")}>
                      <TableCell className="pl-4 tabular-nums">{b.linha}</TableCell>
                      <TableCell className="min-w-44 whitespace-normal">{l.contrato ? rotuloContrato(l.contrato, contexto.contratos) : `${b.cliente || "—"} / ${b.sistema || "—"}`}</TableCell>
                      <TableCell className="whitespace-normal">
                        {l.unidade ? l.unidade.nome : b.estabelecimento || "—"}
                        {l.unidade?.tipo === "nova" && <Novo />}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {l.equipes ? (l.equipes.length ? l.equipes.map((x) => x.nome).join(", ") : "Todas as equipes") : b.equipesTexto || "—"}
                      </TableCell>
                      <TableCell>{l.atividade ? rotuloTipo(l.atividade) : b.atividadeTexto || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {l.prazo ? formatarDataCurta(l.prazo) : b.prazoTexto || "—"}
                        {b.horario && <span className="block text-xs text-muted-foreground">{b.horario}</span>}
                      </TableCell>
                      <TableCell className="min-w-40 pr-4 whitespace-normal">
                        <Badge variant="outline" className={s.classe}>
                          {s.rotulo}
                        </Badge>
                        {l.motivoDuplicada && <div className="mt-0.5 text-xs">{l.motivoDuplicada}</div>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </details>

        {faltam > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="faltam-itens">
            <span>
              Ainda falta resolver {faltam} {faltam === 1 ? "item" : "itens"}. Responda ou pule {faltam === 1 ? "esse item" : "esses itens"} para poder confirmar.
            </span>
            {primeiroPendente >= 0 && (
              <Button size="sm" variant="outline" onClick={() => irPara(primeiroPendente)}>
                Ir ao primeiro item pendente
              </Button>
            )}
          </div>
        )}
        {faltam === 0 && resumo.prontas === 0 && <p className="text-sm text-amber-800">Não há nenhum item novo para importar.</p>}

        {errosGravacao && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>
              <div className="font-medium">Nada foi gravado. O servidor encontrou problemas:</div>
              <ul className="list-disc pl-5">
                {errosGravacao.map((e, i) => (
                  <li key={i}>
                    {e.linha ? `Linha ${e.linha}: ` : ""}
                    {e.mensagem}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <Button variant="outline" disabled={fila.length === 0} onClick={() => irPara(fila.length - 1)}>
            <ArrowLeft />
            Voltar aos itens
          </Button>
          <Button onClick={onConfirmar} disabled={!podeConfirmar(resumo) || pendente}>
            {pendente && <Loader2 className="animate-spin" />}
            Confirmar importação
          </Button>
        </div>
      </Card>
    </div>
  );
}
