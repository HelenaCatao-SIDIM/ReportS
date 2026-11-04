"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, TriangleAlert } from "lucide-react";
import {
  COLUNAS,
  decisoesVazias,
  type Decisao,
  montarPedido,
  perguntasDaPlanilha,
  podeConfirmar,
  resolverLinhas,
  resumir,
  rotuloContrato,
  type Decisoes,
  type LinhaResolvida,
  type Pergunta,
} from "@/lib/importar-cronograma";
import type { ResultadoImportacao } from "@/lib/repo/importar-cronograma";
import { formatarDataCurta, TIPOS_VISITA, rotuloTipo } from "@/lib/visitas";
import type { TipoVisita } from "@/lib/types";
import { cn } from "@/lib/utils";
import { analisarPlanilha, confirmarImportacao, type Analise } from "./actions";
import { selectClass } from "@/components/form/campo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AnaliseOk = Extract<Analise, { ok: true }>;

const SITUACAO: Record<LinhaResolvida["situacao"], { rotulo: string; classe: string }> = {
  pronta: { rotulo: "Pronta", classe: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  decidir: { rotulo: "Falta decidir", classe: "border-amber-300 bg-amber-50 text-amber-900" },
  erro: { rotulo: "Erro", classe: "border-destructive/40 bg-destructive/10 text-destructive" },
  duplicada: { rotulo: "Ignorada", classe: "text-muted-foreground" },
  pulada: { rotulo: "Pulada", classe: "text-muted-foreground" },
};

function Novo() {
  return (
    <Badge variant="outline" className="ml-1.5 border-sky-300 bg-sky-50 text-sky-800">
      novo
    </Badge>
  );
}

function PerguntaCard({ p, podeCadastrar, onDecidir }: { p: Pergunta; podeCadastrar: boolean; onDecidir: (d: Decisao | null) => void }) {
  const decisao = p.decisao;
  const coisa = p.campo === "estabelecimento" ? "estabelecimento" : "setor";
  const ordenadas = [...p.existentes].sort((a, b) => Number(b.id === p.sugerido) - Number(a.id === p.sugerido));
  return (
    <div data-testid="pergunta" className={cn("rounded-lg border p-3", decisao ? "border-emerald-300 bg-emerald-50/50" : "border-amber-300 bg-amber-50")}>
      <div className="text-sm">
        O {coisa} <b>“{p.nome}”</b> não existe em <b>{p.onde}</b>. <span className="text-muted-foreground">Usado nas linhas {[...new Set(p.linhas)].join(", ")}.</span>
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
      {!podeCadastrar && <p className="mt-1.5 text-xs text-muted-foreground">Você não tem permissão para cadastrar {coisa === "setor" ? "setores" : "estabelecimentos"} (reports.clientes.cadastrar): escolha um existente ou pule as linhas.</p>}
      {p.campo === "estabelecimento" && decisao?.acao === "cadastrar" && <p className="mt-1.5 text-xs text-muted-foreground">Será criado só com o nome (raio de 50 m, sem endereço nem coordenadas). Complete depois em Clientes.</p>}
    </div>
  );
}

export function ImportarCronograma() {
  const [analise, setAnalise] = useState<AnaliseOk | null>(null);
  const [dec, setDec] = useState<Decisoes>(decisoesVazias());
  const [erro, setErro] = useState<string | null>(null);
  const [errosGravacao, setErrosGravacao] = useState<{ linha: number; mensagem: string }[] | null>(null);
  const [resultado, setResultado] = useState<Extract<ResultadoImportacao, { ok: true }> | null>(null);
  const [pendente, comeca] = useTransition();

  const resolvidas = useMemo(() => (analise ? resolverLinhas(analise.linhas, analise.contexto, dec) : []), [analise, dec]);
  const resumo = useMemo(() => resumir(resolvidas), [resolvidas]);
  const perguntas = useMemo(() => perguntasDaPlanilha(resolvidas), [resolvidas]);
  const porResponder = perguntas.filter((p) => !p.decisao).length;

  function recomecar() {
    setAnalise(null);
    setDec(decisoesVazias());
    setErro(null);
    setErrosGravacao(null);
    setResultado(null);
  }

  function enviar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    setErro(null);
    comeca(async () => {
      const r = await analisarPlanilha(fd);
      if (!r.ok) setErro(r.erro);
      else {
        setAnalise(r);
        setDec(decisoesVazias());
      }
    });
  }

  function confirmar() {
    setErrosGravacao(null);
    comeca(async () => {
      const r = await confirmarImportacao(montarPedido(resolvidas));
      if (r.ok) setResultado(r);
      else setErrosGravacao(r.erros);
    });
  }

  const alterar = (parcial: Partial<Decisoes>) => setDec((d) => ({ ...d, ...parcial }));

  // ---------- Resultado ----------
  if (resultado) {
    return (
      <Card className="gap-3 p-6" data-testid="resultado">
        <div className="flex items-center gap-2 text-lg font-semibold text-emerald-700">
          <CheckCircle2 className="size-5" />
          Importação concluída
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>
            <b>{resultado.criados}</b> {resultado.criados === 1 ? "item criado" : "itens criados"} no cronograma.
          </li>
          {resultado.estabelecimentosCriados > 0 && <li>{resultado.estabelecimentosCriados} estabelecimento(s) cadastrado(s): complete o endereço e as coordenadas em Clientes.</li>}
          {resultado.setoresCriados > 0 && <li>{resultado.setoresCriados} setor(es) cadastrado(s).</li>}
          {resultado.ignorados > 0 && <li>{resultado.ignorados} já existiam e foram ignorados.</li>}
        </ul>
        <div className="flex gap-2">
          <Button nativeButton={false} render={<Link href="/admin/cronograma" />}>
            Ver o cronograma
          </Button>
          <Button variant="outline" onClick={recomecar}>
            Importar outra planilha
          </Button>
        </div>
      </Card>
    );
  }

  // ---------- Envio ----------
  if (!analise) {
    return (
      <div className="space-y-4">
        <Card className="gap-4 p-5">
          <form onSubmit={enviar} className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1">
              <label htmlFor="arquivo" className="mb-1.5 block text-sm font-medium">
                Planilha do Excel (.xlsx)
              </label>
              <Input id="arquivo" name="arquivo" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required className="h-9" />
            </div>
            <Button type="submit" disabled={pendente}>
              {pendente ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
              Analisar planilha
            </Button>
            <Button variant="outline" nativeButton={false} render={<a href="/admin/cronograma/importar/modelo" download />}>
              <Download />
              Baixar o modelo
            </Button>
          </form>
          {erro && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}
        </Card>
        <Card className="gap-2 p-5 text-sm">
          <div className="font-medium">Como preparar a planilha</div>
          <p className="text-muted-foreground">
            Uma linha por item, com a linha de cabeçalho no topo. As colunas podem estar em qualquer ordem, e acento e maiúsculas não importam. Nada é gravado antes de você conferir a prévia.
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            {COLUNAS.map((c) => (
              <li key={c.chave}>
                <b>{c.rotulo}</b> {c.obrigatoria ? "(obrigatória)" : "(opcional)"}: exemplo “{c.exemplo}”
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">Estabelecimento ou setor que não existir no cadastro: a tela pergunta se você quer cadastrar ou trocar por um existente.</p>
        </Card>
      </div>
    );
  }

  // ---------- Revisão ----------
  const contadores = [
    { rotulo: "Prontas", valor: resumo.prontas },
    { rotulo: "Falta decidir", valor: resumo.decidir },
    { rotulo: "Com erro", valor: resumo.erro },
    { rotulo: "Não serão importadas", valor: resumo.duplicadas + resumo.puladas },
  ];
  const nomeContrato = (l: LinhaResolvida) => (l.contrato ? rotuloContrato(l.contrato, analise.contexto.contratos) : null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          Arquivo <b className="text-foreground">{analise.arquivo}</b>: {resumo.total} {resumo.total === 1 ? "linha" : "linhas"}.
        </div>
        <Button variant="outline" size="sm" onClick={recomecar}>
          Escolher outro arquivo
        </Button>
      </div>

      {analise.avisos.map((a) => (
        <Alert key={a} className="border-amber-300 bg-amber-50 text-amber-900">
          <TriangleAlert />
          <AlertDescription className="text-amber-900">{a}</AlertDescription>
        </Alert>
      ))}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {contadores.map((c) => (
          <Card key={c.rotulo} className="gap-1 px-4 py-3">
            <div className="text-xs text-muted-foreground">{c.rotulo}</div>
            <div className="text-2xl font-semibold" data-testid={`contador-${c.rotulo}`}>
              {c.valor}
            </div>
          </Card>
        ))}
      </div>

      {perguntas.length > 0 && (
        <section className="space-y-2" aria-label="Perguntas">
          <h2 className="text-base font-semibold">
            O que não existe no cadastro ({perguntas.length}
            {porResponder > 0 ? `, ${porResponder} por responder` : ", todas respondidas"})
          </h2>
          <p className="text-sm text-muted-foreground">Para cada nome abaixo, escolha cadastrar como novo ou trocar por um que já existe. A escolha vale para todas as linhas que usam o nome e pode ser mudada até confirmar.</p>
          {perguntas.map((p) => (
            <PerguntaCard
              key={`${p.campo}|${p.chave}`}
              p={p}
              podeCadastrar={analise.podeCadastrar}
              onDecidir={(d) => {
                const tabela = { ...(p.campo === "estabelecimento" ? dec.estab : dec.setor) };
                if (d) tabela[p.chave] = d;
                else delete tabela[p.chave];
                alterar(p.campo === "estabelecimento" ? { estab: tabela } : { setor: tabela });
              }}
            />
          ))}
        </section>
      )}

      <Card className="py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Pular · linha</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Estabelecimento</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Atividade</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead className="pr-4">Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resolvidas.map((l) => {
                const b = l.bruta;
                const s = SITUACAO[l.situacao];
                const apagada = l.situacao === "pulada" || l.situacao === "duplicada";
                return (
                  <TableRow key={b.linha} data-testid={`linha-${b.linha}`} className={cn(apagada && "text-muted-foreground")}>
                    <TableCell className="pl-4">
                      <label className="flex items-center gap-2 tabular-nums" title="Marque para não importar esta linha">
                        <input
                          type="checkbox"
                          aria-label={`Pular a linha ${b.linha}`}
                          checked={!!dec.pular[b.linha]}
                          onChange={(ev) => alterar({ pular: { ...dec.pular, [b.linha]: ev.target.checked } })}
                          className="size-4 accent-primary"
                        />
                        {b.linha}
                      </label>
                    </TableCell>
                    <TableCell className="min-w-44 whitespace-normal">
                      {l.contrato ? (
                        <span className="font-medium">{nomeContrato(l)}</span>
                      ) : (
                        <select
                          aria-label={`Contrato da linha ${b.linha}`}
                          value={dec.contrato[b.linha] ?? ""}
                          onChange={(ev) => alterar({ contrato: ev.target.value ? { ...dec.contrato, [b.linha]: ev.target.value } : Object.fromEntries(Object.entries(dec.contrato).filter(([k]) => Number(k) !== b.linha)) })}
                          className={cn(selectClass, "bg-background")}
                        >
                          <option value="">Escolha o contrato…</option>
                          {l.contratoOpcoes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {rotuloContrato(c, analise.contexto.contratos)}
                            </option>
                          ))}
                        </select>
                      )}
                      {!l.contrato && <div className="mt-0.5 text-xs text-muted-foreground">Planilha: {b.cliente || "—"} / {b.sistema || "—"}</div>}
                    </TableCell>
                    <TableCell>
                      {l.unidade ? (
                        <>
                          {l.unidade.nome}
                          {l.unidade.tipo === "nova" && <Novo />}
                        </>
                      ) : (
                        <span className="text-amber-800">{b.estabelecimento || "—"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {l.setor === null ? (
                        <span className="text-muted-foreground">Todos os setores</span>
                      ) : l.setor ? (
                        <>
                          {l.setor.nome}
                          {l.setor.tipo === "novo" && <Novo />}
                        </>
                      ) : (
                        <span className="text-amber-800">{b.setor || "—"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {b.atividade && !dec.atividade[b.linha] ? (
                        rotuloTipo(b.atividade)
                      ) : (
                        <select
                          aria-label={`Atividade da linha ${b.linha}`}
                          value={dec.atividade[b.linha] ?? ""}
                          onChange={(ev) => alterar({ atividade: { ...dec.atividade, [b.linha]: ev.target.value as TipoVisita } })}
                          className={cn(selectClass, "bg-background")}
                        >
                          <option value="" disabled>
                            {b.atividadeTexto ? `“${b.atividadeTexto}”?` : "Escolha…"}
                          </option>
                          {TIPOS_VISITA.map((t) => (
                            <option key={t.valor} value={t.valor}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {b.prazo && !dec.prazo[b.linha] ? (
                        formatarDataCurta(b.prazo)
                      ) : (
                        <Input
                          aria-label={`Prazo da linha ${b.linha}`}
                          type="date"
                          value={dec.prazo[b.linha] ?? ""}
                          onChange={(ev) => alterar({ prazo: { ...dec.prazo, [b.linha]: ev.target.value } })}
                          className="h-9 w-40 bg-background"
                        />
                      )}
                    </TableCell>
                    <TableCell className="min-w-44 pr-4 whitespace-normal">
                      <Badge variant="outline" className={s.classe}>
                        {s.rotulo}
                      </Badge>
                      {l.motivoDuplicada && <div className="mt-0.5 text-xs">{l.motivoDuplicada}</div>}
                      {l.situacao === "erro" && l.problemas.map((p) => <div key={p} className="mt-0.5 text-xs text-destructive">{p}</div>)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="gap-3 p-5" data-testid="confirmacao">
        <div className="text-base font-semibold">O que vai acontecer</div>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>
            <b>{resumo.prontas}</b> {resumo.prontas === 1 ? "item será criado" : "itens serão criados"} no cronograma.
          </li>
          {resumo.estabelecimentosNovos.length > 0 && (
            <li>
              {resumo.estabelecimentosNovos.length} estabelecimento(s) novo(s) será(ão) cadastrado(s): {resumo.estabelecimentosNovos.map((e) => `“${e.nome}” (${e.cliente})`).join(", ")}.
            </li>
          )}
          {resumo.setoresNovos.length > 0 && (
            <li>
              {resumo.setoresNovos.length} setor(es) novo(s) será(ão) cadastrado(s): {resumo.setoresNovos.map((x) => `“${x.nome}” em ${x.estabelecimento}`).join(", ")}.
            </li>
          )}
          {resumo.duplicadas > 0 && <li>{resumo.duplicadas} linha(s) não serão importadas porque o item já existe ou se repete na planilha.</li>}
          {resumo.puladas > 0 && <li>{resumo.puladas} linha(s) puladas por você.</li>}
        </ul>
        {!podeConfirmar(resumo) && (
          <p className="text-sm text-amber-800">
            {resumo.decidir > 0 || resumo.erro > 0
              ? `Antes de confirmar: resolva ${resumo.decidir > 0 ? `as perguntas (${resumo.decidir} linha(s))` : ""}${resumo.decidir > 0 && resumo.erro > 0 ? " e " : ""}${resumo.erro > 0 ? `os erros (${resumo.erro} linha(s))` : ""}, ou pule essas linhas.`
              : "Não há nenhum item novo para importar."}
          </p>
        )}
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
        <div>
          <Button onClick={confirmar} disabled={!podeConfirmar(resumo) || pendente}>
            {pendente && <Loader2 className="animate-spin" />}
            Confirmar importação
          </Button>
        </div>
      </Card>
    </div>
  );
}
