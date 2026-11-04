import { Suspense } from "react";
import { getUsuarioAtual } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import { horaDoServidor } from "@/lib/agora";
import { dataLocal } from "@/lib/datas";
import { contarPorSituacao, descreverPrazo, estaPendente } from "@/lib/cronograma";
import { listarContratos } from "@/lib/repo/contratos";
import { listarUnidades } from "@/lib/repo/clientes";
import { listarCronograma } from "@/lib/repo/cronograma";
import { formatarDataCurta, rotuloTipo } from "@/lib/visitas";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/placeholder";
import { BotaoAtivo } from "@/components/form/botao-ativo";
import { selectClass } from "@/components/form/campo";
import { SituacaoBadge } from "@/components/cronograma/situacao-badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ItemDialogo, type UnidadeOpcao } from "./item-dialogo";
import { alternarItemCronograma } from "./actions";

const DESCRICAO = "Prazos de treinamento e implantação por estabelecimento e setor. O cumprimento vem das visitas encerradas.";

const FILTROS_SITUACAO = [
  { valor: "", rotulo: "Todos (sem cancelados)" },
  { valor: "pendentes", rotulo: "Pendentes" },
  { valor: "atrasado", rotulo: "Atrasados" },
  { valor: "a_vencer", rotulo: "A vencer" },
  { valor: "no_prazo", rotulo: "No prazo" },
  { valor: "cumprido", rotulo: "Cumpridos" },
  { valor: "cancelado", rotulo: "Cancelados" },
] as const;

export default function CronogramaPage({ searchParams }: PageProps<"/admin/cronograma">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader titulo="Cronograma" descricao={DESCRICAO} />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </>
      }
    >
      <Conteudo searchParams={searchParams} />
    </Suspense>
  );
}

async function Conteudo({ searchParams }: Pick<PageProps<"/admin/cronograma">, "searchParams">) {
  const [sp, usuario, agora] = await Promise.all([searchParams, getUsuarioAtual(), horaDoServidor()]);
  const podeEditar = !!usuario?.permissoes.includes(PERMISSOES.contratosGerenciar);
  const hoje = dataLocal(agora);
  const contratoFiltro = typeof sp.contrato === "string" ? sp.contrato : "";
  const situacaoFiltro = typeof sp.situacao === "string" ? sp.situacao : "";

  const [contratos, todos] = await Promise.all([listarContratos(), listarCronograma(hoje, contratoFiltro ? { contratoId: contratoFiltro } : {})]);
  const rotulo = new Map(contratos.map((c) => [c.id, `${c.clienteNome} — ${c.sistemaNome}`]));
  const ordenados = [...contratos].sort((a, b) => (rotulo.get(a.id) ?? "").localeCompare(rotulo.get(b.id) ?? "", "pt-BR"));

  // Contratos ativos para criar item, e os estabelecimentos e setores dos clientes deles.
  const ativos = ordenados.filter((c) => c.ativo && c.clienteAtivo);
  const clienteIds = [...new Set(ativos.map((c) => c.clienteId))];
  const unidades: Record<string, UnidadeOpcao[]> = Object.fromEntries(
    await Promise.all(clienteIds.map(async (id) => [id, (await listarUnidades(id)).map((u) => ({ id: u.id, nome: u.nome, setores: u.setores.map((s) => ({ id: s.id, nome: s.nome })) }))] as const)),
  );
  const opcoes = { contratos: ativos.map((c) => ({ id: c.id, rotulo: rotulo.get(c.id)!, clienteId: c.clienteId })), unidades };

  const contagem = contarPorSituacao(todos);
  const itens = todos.filter((i) => {
    if (situacaoFiltro === "") return i.situacao !== "cancelado";
    if (situacaoFiltro === "pendentes") return estaPendente(i.situacao);
    if (situacaoFiltro === "cumprido") return i.situacao === "cumprido" || i.situacao === "cumprido_com_atraso";
    return i.situacao === situacaoFiltro;
  });

  const cartoes = [
    { titulo: "Atrasados", valor: contagem.atrasado, destaque: contagem.atrasado > 0 ? "text-destructive" : "" },
    { titulo: "A vencer (até 7 dias)", valor: contagem.a_vencer, destaque: contagem.a_vencer > 0 ? "text-amber-700" : "" },
    { titulo: "No prazo", valor: contagem.no_prazo, destaque: "" },
    { titulo: "Cumpridos", valor: contagem.cumprido + contagem.cumprido_com_atraso, destaque: "" },
  ];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader titulo="Cronograma" descricao={DESCRICAO} />
        {podeEditar && <ItemDialogo opcoes={opcoes} />}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cartoes.map((c) => (
          <Card key={c.titulo} className="gap-1 px-4 py-3">
            <div className="text-xs text-muted-foreground">{c.titulo}</div>
            <div className={cn("text-2xl font-semibold", c.destaque)}>{c.valor}</div>
          </Card>
        ))}
      </div>

      {/* Filtros enviados por GET (ficam na URL) */}
      <form className="mb-4 flex flex-col gap-2 sm:flex-row">
        <select name="contrato" defaultValue={contratoFiltro} aria-label="Filtrar por contrato" className={cn(selectClass, "bg-background sm:w-80")}>
          <option value="">Todos os contratos</option>
          {ordenados.map((c) => (
            <option key={c.id} value={c.id}>
              {rotulo.get(c.id)}
            </option>
          ))}
        </select>
        <select name="situacao" defaultValue={situacaoFiltro} aria-label="Filtrar por situação" className={cn(selectClass, "bg-background sm:w-56")}>
          {FILTROS_SITUACAO.map((f) => (
            <option key={f.valor} value={f.valor}>
              {f.rotulo}
            </option>
          ))}
        </select>
        <button type="submit" className="h-9 rounded-lg border bg-background px-3 text-sm hover:bg-muted">
          Filtrar
        </button>
      </form>

      <Card className="py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Contrato</TableHead>
                <TableHead>Estabelecimento</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Atividade</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Situação</TableHead>
                {podeEditar && <TableHead className="pr-4 text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.length === 0 && (
                <TableRow>
                  <TableCell colSpan={podeEditar ? 7 : 6} className="py-10 text-center text-muted-foreground">
                    {todos.length === 0 ? "Nenhum item no cronograma ainda." : "Nenhum item com esse filtro."}
                  </TableCell>
                </TableRow>
              )}
              {itens.map((i) => (
                <TableRow key={i.id} className={cn(i.situacao === "cancelado" && "text-muted-foreground")}>
                  <TableCell className="pl-4 font-medium">{rotulo.get(i.contratoId) ?? "—"}</TableCell>
                  <TableCell>{i.unidadeNome}</TableCell>
                  <TableCell>{i.setorNome ?? <span className="text-muted-foreground">Todos os setores</span>}</TableCell>
                  <TableCell>{rotuloTipo(i.tipo)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatarDataCurta(i.prazo)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-0.5">
                      <SituacaoBadge situacao={i.situacao} />
                      <span className="text-xs text-muted-foreground">
                        {i.cumpridoEm ? `em ${formatarDataCurta(i.cumpridoEm)}` : estaPendente(i.situacao) ? descreverPrazo(i.diasParaPrazo) : ""}
                      </span>
                    </div>
                  </TableCell>
                  {podeEditar && (
                    <TableCell className="pr-4 text-right whitespace-nowrap">
                      <ItemDialogo item={i} rotuloContrato={rotulo.get(i.contratoId)} opcoes={opcoes} />
                      <BotaoAtivo
                        ativo={!i.cancelado}
                        rotulos={{ desativar: "Cancelar", reativar: "Reativar" }}
                        confirmacao={`Cancelar este item do cronograma? Ele deixa de contar e de aparecer ao técnico e no relatório do cliente.`}
                        acao={alternarItemCronograma.bind(null, i.id, !i.cancelado)}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      {observacaoRodape(itens.length)}
    </>
  );
}

const observacaoRodape = (n: number) => (
  <p className="mt-3 text-xs text-muted-foreground">
    {n} {n === 1 ? "item" : "itens"}. Um item é cumprido quando há uma visita encerrada do mesmo tipo, no estabelecimento e (se o item pede) no setor dele. Item cancelado não conta.
  </p>
);
