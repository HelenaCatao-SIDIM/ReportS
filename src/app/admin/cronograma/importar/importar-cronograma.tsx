"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { COLUNAS, decisoesVazias, linhasQueExigemVoce, montarPedido, resolverLinhas, type Decisoes, type LinhaResolvida } from "@/lib/importar-cronograma";
import type { ResultadoImportacao } from "@/lib/repo/importar-cronograma";
import { analisarPlanilha, confirmarImportacao, type Analise } from "./actions";
import { RevisaoEmEtapas } from "./revisao-etapas";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AnaliseOk = Extract<Analise, { ok: true }>;

export function ImportarCronograma() {
  const [analise, setAnalise] = useState<AnaliseOk | null>(null);
  const [dec, setDec] = useState<Decisoes>(decisoesVazias());
  /** Os itens que precisam do usuário, fixados na primeira análise; o passo é o índice nessa lista (o último é o resumo). */
  const [filaInicial, setFilaInicial] = useState<LinhaResolvida[]>([]);
  const [passo, setPasso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [errosGravacao, setErrosGravacao] = useState<{ linha: number; mensagem: string }[] | null>(null);
  const [resultado, setResultado] = useState<Extract<ResultadoImportacao, { ok: true }> | null>(null);
  const [pendente, comeca] = useTransition();

  const resolvidas = useMemo(() => (analise ? resolverLinhas(analise.linhas, analise.contexto, dec) : []), [analise, dec]);

  function recomecar() {
    setAnalise(null);
    setDec(decisoesVazias());
    setFilaInicial([]);
    setPasso(0);
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
        setFilaInicial(linhasQueExigemVoce(resolverLinhas(r.linhas, r.contexto, decisoesVazias())));
        setPasso(0);
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
            Uma linha por item, com a linha de cabeçalho no topo. As colunas podem estar em qualquer ordem, e acento e maiúsculas não importam. Nada é gravado antes de você conferir e confirmar.
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            {COLUNAS.map((c) => (
              <li key={c.chave}>
                <b>{c.rotulo}</b> {c.obrigatoria ? "(obrigatória)" : "(opcional)"}: exemplo “{c.exemplo}”
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">Estabelecimento ou setor que não existir no cadastro: a tela pergunta se você quer cadastrar ou trocar por um existente, um item de cada vez. Só aparecem os itens que precisam de você; os que estão certos entram sozinhos.</p>
        </Card>
      </div>
    );
  }

  // ---------- Revisão, um item por vez ----------
  return (
    <RevisaoEmEtapas
      arquivo={analise.arquivo}
      avisos={analise.avisos}
      contexto={analise.contexto}
      podeCadastrar={analise.podeCadastrar}
      filaInicial={filaInicial}
      resolvidas={resolvidas}
      dec={dec}
      alterar={alterar}
      passo={passo}
      irPara={setPasso}
      pendente={pendente}
      errosGravacao={errosGravacao}
      onConfirmar={confirmar}
      onRecomecar={recomecar}
    />
  );
}
