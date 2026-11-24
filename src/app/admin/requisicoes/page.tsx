import { Suspense } from "react";
import { Activity } from "lucide-react";
import { listarRequisicoes, LIMITE_REQUISICOES } from "@/lib/repo/requisicoes";
import type { DesfechoRequisicao, RegistroRequisicao } from "@/lib/types";
import { fimDoDia, formatarDataHora, inicioDoDia } from "@/lib/datas";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/placeholder";
import { selectClass } from "@/components/form/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const TITULO = "Logs de requisição";
const DESCRICAO = "Tudo que entra no sistema: quando, o método, o caminho, quem (se logado), o IP e o que o proxy fez. Guarda 30 dias.";

/** Rótulo e cor de cada desfecho do proxy. */
const DESFECHO: Record<DesfechoRequisicao, { rotulo: string; classe: string }> = {
  ok: { rotulo: "Passou", classe: "bg-emerald-100 text-emerald-800" },
  login: { rotulo: "→ Login", classe: "bg-amber-100 text-amber-800" },
  inicio: { rotulo: "→ Início", classe: "bg-sky-100 text-sky-800" },
};
const DESFECHOS = Object.keys(DESFECHO) as DesfechoRequisicao[];

const METODOS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];

export default function RequisicoesPage({ searchParams }: PageProps<"/admin/requisicoes">) {
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

async function Conteudo({ searchParams }: Pick<PageProps<"/admin/requisicoes">, "searchParams">) {
  const sp = await searchParams;
  const metodo = METODOS.includes(str(sp.metodo)) ? str(sp.metodo) : undefined;
  const desfecho = DESFECHOS.includes(str(sp.desfecho) as DesfechoRequisicao) ? (str(sp.desfecho) as DesfechoRequisicao) : undefined;
  const f = { texto: str(sp.q), de: str(sp.de), ate: str(sp.ate) };

  const registros = await listarRequisicoes({
    metodo,
    desfecho,
    texto: f.texto || undefined,
    de: f.de ? inicioDoDia(f.de) : undefined,
    ate: f.ate ? fimDoDia(f.ate) : undefined,
  });

  return (
    <div className="mt-4">
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted-foreground">
          Buscar caminho
          <Input name="q" defaultValue={f.texto} placeholder="Ex.: /admin/visitas" className="h-9 w-64 bg-background" />
        </label>
        <select name="metodo" defaultValue={metodo ?? ""} aria-label="Método" className={cn(selectClass, "w-auto bg-background")}>
          <option value="">Todos os métodos</option>
          {METODOS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select name="desfecho" defaultValue={desfecho ?? ""} aria-label="Desfecho" className={cn(selectClass, "w-auto bg-background")}>
          <option value="">Todos os desfechos</option>
          {DESFECHOS.map((d) => (
            <option key={d} value={d}>
              {DESFECHO[d].rotulo}
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

function Lista({ registros }: { registros: RegistroRequisicao[] }) {
  return (
    <>
      <Card className="py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Quando</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Caminho</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>IP</TableHead>
                <TableHead className="pr-4">Desfecho</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registros.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    Nenhuma requisição registrada para esse filtro.
                  </TableCell>
                </TableRow>
              )}
              {registros.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-4 whitespace-nowrap text-sm">{formatarDataHora(r.em)}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">{r.metodo}</TableCell>
                  <TableCell className="max-w-80 truncate font-mono text-xs">{r.caminho}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{r.usuarioNome}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{r.ip || "—"}</TableCell>
                  <TableCell className="pr-4">
                    <Badge variant="secondary" className={cn("font-medium", DESFECHO[r.desfecho]?.classe)}>
                      {DESFECHO[r.desfecho]?.rotulo ?? r.desfecho}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Activity className="size-3.5" />
        {registros.length} {registros.length === 1 ? "requisição" : "requisições"}.
        {registros.length >= LIMITE_REQUISICOES && ` Mostrando as ${LIMITE_REQUISICOES} mais recentes — refine o período ou a busca para ver as anteriores.`}
      </p>
    </>
  );
}
