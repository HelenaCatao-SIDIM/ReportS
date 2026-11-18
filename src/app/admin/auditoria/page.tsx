import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, ScrollText } from "lucide-react";
import { listarAuditoria, LIMITE_AUDITORIA, type RegistroAuditoria } from "@/lib/repo/visitas";
import { listarClientes } from "@/lib/repo/clientes";
import { listarComPermissao } from "@/lib/repo/usuarios";
import { PERMISSOES } from "@/lib/permissoes";
import type { AlteracaoVisita } from "@/lib/types";
import { fimDoDia, formatarData, formatarDataHora, inicioDoDia } from "@/lib/datas";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/placeholder";
import { selectClass } from "@/components/form/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const TITULO = "Auditoria";
const DESCRICAO = "Tudo que a administração mudou nas visitas: quem, quando, a ação e cada campo antes e depois.";

/** Rótulo e cor de cada tipo de ação registrada no histórico da visita. */
const ACAO: Record<AlteracaoVisita["acao"], { rotulo: string; classe: string }> = {
  encerramento: { rotulo: "Encerramento", classe: "bg-amber-100 text-amber-800" },
  cancelamento: { rotulo: "Cancelamento", classe: "bg-rose-100 text-rose-800" },
  correcao: { rotulo: "Correção", classe: "bg-sky-100 text-sky-800" },
  lancamento: { rotulo: "Lançamento retroativo", classe: "bg-emerald-100 text-emerald-800" },
};

const ACOES = Object.keys(ACAO) as AlteracaoVisita["acao"][];

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
  const acao = ACOES.includes(str(sp.acao) as AlteracaoVisita["acao"]) ? (str(sp.acao) as AlteracaoVisita["acao"]) : undefined;
  const f = { cliente: str(sp.cliente), tecnico: str(sp.tecnico), de: str(sp.de), ate: str(sp.ate) };

  const [registros, clientes, tecnicos] = await Promise.all([
    listarAuditoria({
      clienteId: f.cliente || undefined,
      tecnicoId: f.tecnico || undefined,
      acao,
      de: f.de ? inicioDoDia(f.de) : undefined,
      ate: f.ate ? fimDoDia(f.ate) : undefined,
    }),
    listarClientes(),
    listarComPermissao(PERMISSOES.tecnico),
  ]);

  return (
    <div className="mt-4">
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <select name="cliente" defaultValue={f.cliente} aria-label="Cliente" className={cn(selectClass, "w-auto bg-background")}>
          <option value="">Todos os clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <select name="tecnico" defaultValue={f.tecnico} aria-label="Técnico" className={cn(selectClass, "w-auto bg-background")}>
          <option value="">Todos os técnicos</option>
          {tecnicos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
        <select name="acao" defaultValue={acao ?? ""} aria-label="Ação" className={cn(selectClass, "w-auto bg-background")}>
          <option value="">Todas as ações</option>
          {ACOES.map((a) => (
            <option key={a} value={a}>
              {ACAO[a].rotulo}
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
                <TableHead>Visita</TableHead>
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
              {registros.map((r) => (
                <TableRow key={r.id} className="align-top">
                  <TableCell className="pl-4 whitespace-nowrap text-sm">{formatarDataHora(r.em)}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm font-medium">{r.autorNome}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("font-medium", ACAO[r.acao].classe)}>
                      {ACAO[r.acao].rotulo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    <Link href={`/admin/visitas/${r.visitaId}`} className="font-medium text-primary hover:underline">
                      {r.clienteNome}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {r.tecnicoNome} · {formatarData(r.entradaVisita)}
                    </span>
                  </TableCell>
                  <TableCell className="pr-4">
                    <p className="text-sm">
                      <span className="text-muted-foreground">Motivo:</span> {r.motivo}
                    </p>
                    {r.mudancas.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {r.mudancas.map((m, i) => (
                          <li key={i} className="flex flex-wrap items-center gap-1.5 rounded bg-muted/60 px-2 py-1 text-xs">
                            <span className="font-medium">{m.campo}:</span>
                            <span className="text-muted-foreground line-through">{m.antes || "—"}</span>
                            <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                            <span>{m.depois || "—"}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ScrollText className="size-3.5" />
        {registros.length} {registros.length === 1 ? "alteração" : "alterações"}.
        {registros.length >= LIMITE_AUDITORIA && ` Mostrando as ${LIMITE_AUDITORIA} mais recentes — refine o período para ver as anteriores.`}
      </p>
    </>
  );
}
