import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, ScrollText } from "lucide-react";
import { listarAuditoria, LIMITE_AUDITORIA } from "@/lib/repo/auditoria";
import type { AcaoAuditoria, EntidadeAuditoria, RegistroAuditoria } from "@/lib/types";
import { fimDoDia, formatarDataHora, inicioDoDia } from "@/lib/datas";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/placeholder";
import { selectClass } from "@/components/form/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const TITULO = "Auditoria";
const DESCRICAO = "Tudo que a administração mudou no sistema: quem, quando, a ação e cada campo antes e depois.";

/** Rótulo de cada tipo de registro (no singular, como aparece na coluna e no filtro). */
const ENTIDADE: Record<EntidadeAuditoria, string> = {
  cliente: "Cliente",
  estabelecimento: "Estabelecimento",
  contrato: "Contrato",
  aprovador: "Aprovador",
  tema: "Tema",
  equipe: "Equipe",
  participante: "Participante",
  cronograma: "Cronograma",
  relatorio: "Relatório",
  configuracao: "Configuração",
  visita: "Visita",
};

const ENTIDADES = Object.keys(ENTIDADE) as EntidadeAuditoria[];

/** Rótulo e cor de cada ação. */
const ACAO: Record<AcaoAuditoria, { rotulo: string; classe: string }> = {
  criar: { rotulo: "Criou", classe: "bg-emerald-100 text-emerald-800" },
  editar: { rotulo: "Editou", classe: "bg-sky-100 text-sky-800" },
  excluir: { rotulo: "Excluiu", classe: "bg-rose-100 text-rose-800" },
  ativar: { rotulo: "Ativou", classe: "bg-emerald-100 text-emerald-800" },
  inativar: { rotulo: "Inativou", classe: "bg-amber-100 text-amber-800" },
  encerrar: { rotulo: "Encerrou", classe: "bg-amber-100 text-amber-800" },
  cancelar: { rotulo: "Cancelou", classe: "bg-rose-100 text-rose-800" },
  corrigir: { rotulo: "Corrigiu", classe: "bg-sky-100 text-sky-800" },
  lancar: { rotulo: "Lançou", classe: "bg-emerald-100 text-emerald-800" },
  emitir: { rotulo: "Emitiu", classe: "bg-sky-100 text-sky-800" },
  enviar: { rotulo: "Enviou", classe: "bg-sky-100 text-sky-800" },
  importar: { rotulo: "Importou", classe: "bg-emerald-100 text-emerald-800" },
};

export default function AuditoriaPage({ searchParams }: PageProps<"/admin/auditoria">) {
  return (
    <>
      <PageHeader titulo={TITULO} descricao={DESCRICAO} />
      <Suspense fallback={<div className="mt-4 h-64 animate-pulse rounded-xl bg-muted" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

async function Conteudo({ searchParams }: Pick<PageProps<"/admin/auditoria">, "searchParams">) {
  const sp = await searchParams;
  const entidade = ENTIDADES.includes(str(sp.entidade) as EntidadeAuditoria) ? (str(sp.entidade) as EntidadeAuditoria) : undefined;
  const f = { texto: str(sp.q), de: str(sp.de), ate: str(sp.ate) };

  const registros = await listarAuditoria({
    entidade,
    texto: f.texto || undefined,
    de: f.de ? inicioDoDia(f.de) : undefined,
    ate: f.ate ? fimDoDia(f.ate) : undefined,
  });

  return (
    <div className="mt-4">
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted-foreground">
          Buscar
          <Input name="q" defaultValue={f.texto} placeholder="Quem fez ou o nome do registro" className="h-9 w-64 bg-background" />
        </label>
        <select name="entidade" defaultValue={entidade ?? ""} aria-label="Tipo de registro" className={cn(selectClass, "w-auto bg-background")}>
          <option value="">Todos os tipos</option>
          {ENTIDADES.map((e) => (
            <option key={e} value={e}>
              {ENTIDADE[e]}
            </option>
          ))}
        </select>
        <label className="text-xs text-muted-foreground">
          De
          <Input type="date" name="de" defaultValue={f.de} className="h-9 bg-background" />
        </label>
        <label className="text-xs text-muted-foreground">
          Até
          <Input type="date" name="ate" defaultValue={f.ate} className="h-9 bg-background" />
        </label>
        <Button type="submit" variant="outline" className="h-9">
          Filtrar
        </Button>
      </form>

      <Lista registros={registros} />
    </div>
  );
}

/** Link para o registro quando dá para abri-lo na Administração; senão, só o rótulo. */
function alvo(r: RegistroAuditoria): string | null {
  if (r.acao === "excluir") return null; // o registro não existe mais
  if (r.entidade === "visita") return `/admin/visitas/${r.entidadeId}`;
  return null;
}

function Lista({ registros }: { registros: RegistroAuditoria[] }) {
  return (
    <>
      <Card className="py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Quando</TableHead>
                <TableHead>Quem</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead className="pr-4">O que mudou</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registros.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    Nenhuma alteração registrada para esse filtro.
                  </TableCell>
                </TableRow>
              )}
              {registros.map((r) => {
                const href = alvo(r);
                return (
                  <TableRow key={r.id} className="align-top">
                    <TableCell className="pl-4 whitespace-nowrap text-sm">{formatarDataHora(r.em)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm font-medium">{r.autorNome}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn("font-medium", ACAO[r.acao]?.classe)}>
                        {ACAO[r.acao]?.rotulo ?? r.acao}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="text-xs text-muted-foreground">{ENTIDADE[r.entidade] ?? r.entidade}</span>
                      <span className="block font-medium">
                        {href ? (
                          <Link href={href} className="text-primary hover:underline">
                            {r.rotulo || "—"}
                          </Link>
                        ) : (
                          r.rotulo || "—"
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="pr-4">
                      {r.mudancas.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <ul className="space-y-1">
                          {r.mudancas.map((m, i) => (
                            <li key={i} className="flex flex-wrap items-center gap-1.5 rounded bg-muted/60 px-2 py-1 text-xs">
                              <span className="font-medium">{m.campo}:</span>
                              <span className="text-muted-foreground line-through">{m.antes}</span>
                              <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                              <span>{m.depois}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ScrollText className="size-3.5" />
        {registros.length} {registros.length === 1 ? "alteração" : "alterações"}.
        {registros.length >= LIMITE_AUDITORIA && ` Mostrando as ${LIMITE_AUDITORIA} mais recentes — refine o período ou a busca para ver as anteriores.`}
      </p>
    </>
  );
}
