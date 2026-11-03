import { Suspense } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, Search } from "lucide-react";
import { listarClientes, listarUnidades } from "@/lib/repo/clientes";
import { listarEquipes } from "@/lib/repo/equipes";
import { listarParticipantes } from "@/lib/repo/participantes";
import { situacaoTreinamento, type SituacaoTreinamento } from "@/lib/treinamento";
import { formatarCbo, formatarCpf } from "@/lib/format";
import { PageHeader } from "@/components/shell/placeholder";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ParticipanteDialogo } from "./participante-dialogo";
import { SeletorCliente } from "./seletor-cliente";

const TITULO = "Participantes";
const DESCRICAO = "Pessoas que costumam participar dos treinamentos, por cliente. O técnico só seleciona quem compareceu.";

/** Equipe da pessoa e os temas mínimos que ela ainda não recebeu. */
function Treinamento({ s }: { s: SituacaoTreinamento | undefined }) {
  if (!s?.equipe) return <span className="text-xs text-muted-foreground">Sem equipe</span>;
  return (
    <div className="max-w-64 space-y-0.5">
      <div>{s.equipe.nome}</div>
      {s.pendentes.length ? (
        <div className="flex items-start gap-1 text-xs text-amber-700">
          <CircleAlert className="mt-px size-3.5 shrink-0" />
          <span>Falta: {s.pendentes.map((t) => t.nome).join(", ")}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-xs text-emerald-700">
          <CircleCheck className="size-3.5 shrink-0" />
          Temas mínimos em dia
        </div>
      )}
    </div>
  );
}

export default function ParticipantesPage({ searchParams }: PageProps<"/admin/participantes">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader titulo={TITULO} descricao={DESCRICAO} />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </>
      }
    >
      <Conteudo searchParams={searchParams} />
    </Suspense>
  );
}

async function Conteudo({ searchParams }: Pick<PageProps<"/admin/participantes">, "searchParams">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const soPendentes = sp.pendentes === "1";
  const clientes = await listarClientes();
  const cliente = clientes.find((c) => c.id === sp.cliente) ?? clientes[0];

  if (!cliente) {
    return (
      <>
        <PageHeader titulo={TITULO} descricao={DESCRICAO} />
        <Card className="items-center py-10 text-sm text-muted-foreground">Cadastre um cliente primeiro.</Card>
      </>
    );
  }

  const [encontrados, unidades, equipes, situacao] = await Promise.all([
    listarParticipantes(cliente.id, q),
    listarUnidades(cliente.id),
    listarEquipes(),
    situacaoTreinamento(cliente.id),
  ]);
  const setores = [...new Set(unidades.flatMap((u) => u.setores.map((s) => s.nome)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const comPendencia = (id: string) => !!situacao.get(id)?.pendentes.length;
  const participantes = soPendentes ? encontrados.filter((p) => comPendencia(p.id)) : encontrados;
  const totalPendentes = encontrados.filter((p) => comPendencia(p.id)).length;
  const colunas = cliente.exigeCpf ? 8 : 7;
  const filtro = (pendentes: boolean) => ({ pathname: "/admin/participantes", query: { cliente: cliente.id, ...(q && { q }), ...(pendentes && { pendentes: "1" }) } });

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader titulo={TITULO} descricao={DESCRICAO} />
        <ParticipanteDialogo clienteId={cliente.id} exigeCpf={cliente.exigeCpf} setores={setores} equipes={equipes} />
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SeletorCliente clientes={clientes.map((c) => ({ id: c.id, nome: c.nome }))} atual={cliente.id} />
        <form className="relative w-full sm:max-w-xs">
          <input type="hidden" name="cliente" value={cliente.id} />
          {soPendentes && <input type="hidden" name="pendentes" value="1" />}
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Buscar nome, cargo ou setor" className="h-9 bg-background pl-8" />
        </form>
        <Link href={filtro(!soPendentes)} className="text-sm text-primary hover:underline">
          {soPendentes ? "Mostrar todos" : `Só com treinamento pendente (${totalPendentes})`}
        </Link>
        <span className="text-xs text-muted-foreground sm:ml-auto">
          {cliente.exigeCpf ? "Este cliente exige CPF." : "Este cliente não exige CPF."}
        </span>
      </div>

      <Card className="py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Nome</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>CBO</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Equipe e treinamento</TableHead>
                {cliente.exigeCpf && <TableHead>CPF</TableHead>}
                <TableHead>Origem</TableHead>
                <TableHead className="pr-4 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participantes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={colunas} className="py-10 text-center text-muted-foreground">
                    Nenhum participante encontrado.
                  </TableCell>
                </TableRow>
              )}
              {participantes.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="pl-4 font-medium">{p.nome}</TableCell>
                  <TableCell>{p.cargo}</TableCell>
                  <TableCell className="max-w-56">
                    <span className="font-mono text-xs text-muted-foreground">{formatarCbo(p.cbo.codigo)}</span>
                    <span className="block truncate text-xs">{p.cbo.titulo}</span>
                  </TableCell>
                  <TableCell>{p.setor}</TableCell>
                  <TableCell className="whitespace-normal">
                    <Treinamento s={situacao.get(p.id)} />
                  </TableCell>
                  {cliente.exigeCpf && <TableCell className="font-mono text-xs">{p.cpf ? formatarCpf(p.cpf) : "—"}</TableCell>}
                  <TableCell>
                    {p.criadoEmCampo ? <Badge variant="secondary">Em campo</Badge> : <span className="text-xs text-muted-foreground">Cadastro</span>}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <ParticipanteDialogo clienteId={cliente.id} exigeCpf={cliente.exigeCpf} setores={setores} equipes={equipes} participante={p} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        {participantes.length} {participantes.length === 1 ? "participante" : "participantes"}. Um tema mínimo só sai da pendência quando a pessoa
        está na lista de presença de uma visita com o tema marcado. &quot;Em campo&quot; = cadastrado pelo técnico durante uma visita. O CPF completo só aparece aqui, para o gestor.
      </p>
    </>
  );
}
