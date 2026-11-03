import { Suspense } from "react";
import { Search } from "lucide-react";
import { listarClientes, listarUnidades } from "@/lib/repo/clientes";
import { listarParticipantes } from "@/lib/repo/participantes";
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

  const [participantes, unidades] = await Promise.all([listarParticipantes(cliente.id, q), listarUnidades(cliente.id)]);
  const setores = [...new Set(unidades.flatMap((u) => u.setores.map((s) => s.nome)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const colunas = cliente.exigeCpf ? 7 : 6;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader titulo={TITULO} descricao={DESCRICAO} />
        <ParticipanteDialogo clienteId={cliente.id} exigeCpf={cliente.exigeCpf} setores={setores} />
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SeletorCliente clientes={clientes.map((c) => ({ id: c.id, nome: c.nome }))} atual={cliente.id} />
        <form className="relative w-full sm:max-w-xs">
          <input type="hidden" name="cliente" value={cliente.id} />
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Buscar nome, cargo ou setor" className="h-9 bg-background pl-8" />
        </form>
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
                  {cliente.exigeCpf && <TableCell className="font-mono text-xs">{p.cpf ? formatarCpf(p.cpf) : "—"}</TableCell>}
                  <TableCell>
                    {p.criadoEmCampo ? <Badge variant="secondary">Em campo</Badge> : <span className="text-xs text-muted-foreground">Cadastro</span>}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <ParticipanteDialogo clienteId={cliente.id} exigeCpf={cliente.exigeCpf} setores={setores} participante={p} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        {participantes.length} {participantes.length === 1 ? "participante" : "participantes"}. &quot;Em campo&quot; = cadastrado pelo técnico durante uma visita. O CPF completo só aparece aqui, para o gestor.
      </p>
    </>
  );
}
