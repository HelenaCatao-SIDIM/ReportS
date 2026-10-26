import { Suspense } from "react";
import { Search } from "lucide-react";
import { listarTemas, sugestoes as carregarSugestoes } from "@/lib/repo/temas";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/placeholder";
import { BotaoAtivo } from "@/components/form/botao-ativo";
import { selectClass } from "@/components/form/campo";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TemaDialogo } from "./tema-dialogo";
import { alternarTema } from "./actions";

export default function TemasPage({ searchParams }: PageProps<"/admin/temas">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader titulo="Temas" descricao="Lista de temas que o técnico marca durante a visita." />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </>
      }
    >
      <Conteudo searchParams={searchParams} />
    </Suspense>
  );
}

async function Conteudo({ searchParams }: Pick<PageProps<"/admin/temas">, "searchParams">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const sistema = typeof sp.sistema === "string" ? sp.sistema : "";
  const [temas, sugestoes] = await Promise.all([listarTemas({ busca: q, sistema: sistema || undefined }), carregarSugestoes()]);
  const ativos = temas.filter((t) => t.ativo).length;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader titulo="Temas" descricao="Lista de temas que o técnico marca durante a visita." />
        <TemaDialogo sugestoes={sugestoes} />
      </div>

      {/* Busca e filtro enviados por GET (ficam na URL) */}
      <form className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Buscar tema, sistema ou módulo" className="h-9 bg-background pl-8" />
        </div>
        <select name="sistema" defaultValue={sistema} aria-label="Filtrar por sistema" className={cn(selectClass, "bg-background sm:w-56")}>
          <option value="">Todos os sistemas</option>
          {sugestoes.sistemas.map((s) => (
            <option key={s} value={s}>
              {s}
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
                <TableHead className="pl-4">Tema</TableHead>
                <TableHead>Sistema</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="pr-4 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {temas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    Nenhum tema encontrado.
                  </TableCell>
                </TableRow>
              )}
              {temas.map((t) => (
                <TableRow key={t.id} className={cn(!t.ativo && "text-muted-foreground")}>
                  <TableCell className="pl-4 font-medium">{t.nome}</TableCell>
                  <TableCell>{t.sistema}</TableCell>
                  <TableCell>{t.modulo}</TableCell>
                  <TableCell>
                    <Badge variant={t.ativo ? "outline" : "destructive"}>{t.ativo ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                  <TableCell className="pr-4 text-right whitespace-nowrap">
                    <TemaDialogo tema={t} sugestoes={sugestoes} />
                    <BotaoAtivo
                      ativo={t.ativo}
                      confirmacao={`Inativar o tema "${t.nome}"? Ele deixa de aparecer para o técnico, mas continua nas visitas já registradas.`}
                      acao={alternarTema.bind(null, t.id, !t.ativo)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        {temas.length} {temas.length === 1 ? "tema" : "temas"} ({ativos} {ativos === 1 ? "ativo" : "ativos"}). Temas inativos não aparecem para o técnico.
      </p>
    </>
  );
}
