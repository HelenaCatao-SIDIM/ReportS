import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, MapPinCheck, MapPinOff } from "lucide-react";
import { listarEmAndamento, listarEncerradas, type VisitaDetalhada } from "@/lib/repo/visitas";
import { listarClientes } from "@/lib/repo/clientes";
import { listarUsuarios } from "@/lib/repo/usuarios";
import { fimDoDia, formatarData, formatarDataHora, formatarDuracao, formatarHora, inicioDoDia } from "@/lib/datas";
import { horaDoServidor } from "@/lib/agora";
import { dentroDoRaio, foraDoRaio, formatarDistancia } from "@/lib/distancia";
import { rotuloTipo } from "@/lib/visitas";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/placeholder";
import { selectClass } from "@/components/form/campo";
import { SelosVisita } from "@/components/visita/selos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AcoesAndamento } from "./acoes-andamento";

const TITULO = "Visitas";
const DESCRICAO = "Acompanhe as visitas em andamento, encerre as esquecidas e corrija as encerradas.";
/** A partir de quantas horas aberta a visita é destacada como possivelmente esquecida. */
const HORAS_ALERTA = 10;

export default function VisitasPage({ searchParams }: PageProps<"/admin/visitas">) {
  return (
    <>
      <PageHeader titulo={TITULO} descricao={DESCRICAO} />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

async function Conteudo({ searchParams }: Pick<PageProps<"/admin/visitas">, "searchParams">) {
  const sp = await searchParams;
  const aba = sp.aba === "encerradas" ? "encerradas" : "andamento";
  const emAndamento = await listarEmAndamento();

  return (
    <>
      <div className="mb-4 flex gap-1 border-b">
        {[
          { id: "andamento", label: "Em andamento", n: emAndamento.length, href: "/admin/visitas" },
          { id: "encerradas", label: "Encerradas", n: null, href: "/admin/visitas?aba=encerradas" },
        ].map((t) => (
          <Link
            key={t.id}
            href={t.href}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm",
              aba === t.id ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.n !== null && <Badge variant={t.n ? "default" : "secondary"}>{t.n}</Badge>}
          </Link>
        ))}
      </div>
      {aba === "andamento" ? <EmAndamento visitas={emAndamento} agora={await horaDoServidor()} /> : <Encerradas sp={sp} />}
    </>
  );
}

function EmAndamento({ visitas, agora }: { visitas: VisitaDetalhada[]; agora: number }) {
  return (
    <Card className="py-0">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Técnico</TableHead>
              <TableHead>Cliente / estabelecimento</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Entrada</TableHead>
              <TableHead>Aberta há</TableHead>
              <TableHead className="pr-4 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visitas.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Nenhuma visita em andamento.
                </TableCell>
              </TableRow>
            )}
            {visitas.map((v) => {
              const horas = (agora - new Date(v.entrada).getTime()) / 3600_000;
              const alerta = horas >= HORAS_ALERTA;
              return (
                <TableRow key={v.id}>
                  <TableCell className="pl-4 font-medium">{v.tecnicoNome}</TableCell>
                  <TableCell>
                    {v.clienteNome}
                    <span className="block text-xs text-muted-foreground">{v.sistemaNome} · {v.unidadeNome}</span>
                    {dentroDoRaio(v) && (
                      <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-emerald-700">
                        <MapPinCheck className="size-3" />
                        Check-in dentro do raio ({formatarDistancia(v.distanciaCheckinM!)}; limite {formatarDistancia(v.raioCheckinM!)})
                      </span>
                    )}
                    {foraDoRaio(v) && (
                      <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-amber-700">
                        <MapPinOff className="size-3" />
                        Check-in fora do raio ({formatarDistancia(v.distanciaCheckinM!)}; limite {formatarDistancia(v.raioCheckinM!)})
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{rotuloTipo(v.tipo)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatarDataHora(v.entrada)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className={cn(alerta && "font-medium text-amber-700")}>
                      {alerta && <AlertTriangle className="mr-1 inline size-3.5 -translate-y-px" />}
                      {formatarDuracao(v.entrada, agora)}
                    </span>
                    {alerta && <span className="block text-xs text-amber-700">Possivelmente esquecida</span>}
                  </TableCell>
                  <TableCell className="pr-4 text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/admin/visitas/${v.id}`} />}>
                      Ver
                    </Button>
                    <AcoesAndamento
                      visita={{ id: v.id, tecnicoNome: v.tecnicoNome, clienteNome: v.clienteNome, entrada: v.entrada, entradaTexto: formatarDataHora(v.entrada) }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

async function Encerradas({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const f = { cliente: str(sp.cliente), tecnico: str(sp.tecnico), de: str(sp.de), ate: str(sp.ate), canceladas: sp.canceladas === "1" };
  const [visitas, clientes, tecnicos] = await Promise.all([
    listarEncerradas({
      clienteId: f.cliente || undefined,
      tecnicoId: f.tecnico || undefined,
      de: f.de ? inicioDoDia(f.de) : undefined,
      ate: f.ate ? fimDoDia(f.ate) : undefined,
      incluirCanceladas: f.canceladas,
    }),
    listarClientes(),
    listarUsuarios({ perfil: "tecnico" }),
  ]);

  return (
    <>
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="aba" value="encerradas" />
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
        <label className="text-xs text-muted-foreground">
          De
          <Input type="date" name="de" defaultValue={f.de} className="h-9 bg-background" />
        </label>
        <label className="text-xs text-muted-foreground">
          Até
          <Input type="date" name="ate" defaultValue={f.ate} className="h-9 bg-background" />
        </label>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" name="canceladas" value="1" defaultChecked={f.canceladas} className="size-4 accent-primary" />
          Incluir canceladas
        </label>
        <Button type="submit" variant="outline" className="h-9">
          Filtrar
        </Button>
      </form>

      <Card className="py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Data</TableHead>
                <TableHead>Cliente / estabelecimento</TableHead>
                <TableHead>Técnico</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="pr-4 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visitas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Nenhuma visita encontrada.
                  </TableCell>
                </TableRow>
              )}
              {visitas.map((v) => (
                <TableRow key={v.id} className={cn(v.status === "cancelada" && "text-muted-foreground")}>
                  <TableCell className="pl-4 whitespace-nowrap">{formatarData(v.entrada)}</TableCell>
                  <TableCell>
                    {v.clienteNome}
                    <span className="block text-xs text-muted-foreground">{v.sistemaNome} · {v.unidadeNome}</span>
                  </TableCell>
                  <TableCell>{v.tecnicoNome}</TableCell>
                  <TableCell>{rotuloTipo(v.tipo)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatarHora(v.entrada)}
                    {v.saida && (
                      <>
                        {" – "}
                        {formatarHora(v.saida)}
                        <span className="block text-xs text-muted-foreground">{formatarDuracao(v.entrada, v.saida)}</span>
                      </>
                    )}
                  </TableCell>
                  <TableCell>
                    <SelosVisita visita={v} alertaRaio />
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/admin/visitas/${v.id}`} />}>
                      Abrir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        {visitas.length} {visitas.length === 1 ? "visita" : "visitas"}. O período considera a data de entrada.
      </p>
    </>
  );
}
