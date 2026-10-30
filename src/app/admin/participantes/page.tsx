import { Suspense } from "react";
import { Search } from "lucide-react";
import { listarClientes, listarUnidades } from "@/lib/repo/clientes";
import { buscarContratoDoSistemaDoCliente } from "@/lib/repo/contratos";
import { listarParticipantes } from "@/lib/repo/participantes";
import { formatarCbo, formatarCpf } from "@/lib/format";
import { PageHeader } from "@/components/shell/placeholder";
import { Input } from "@/components/ui/input";
import { SeloParticipante } from "@/components/participante/selo-participante";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ParticipanteDialogo } from "./participante-dialogo";
import { SeletorParticipantes } from "./seletor-cliente";

const TITULO = "Participantes";
const DESCRICAO = "Pessoas que participam dos treinamentos, por cliente e sistema. O confirmado vem do ERP; o provisório é cadastrado aqui ou pelo técnico em campo.";

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
  const clientes = (await listarClientes()).filter((c) => c.sistemas.length > 0);
  const cliente = clientes.find((c) => c.id === sp.cliente) ?? clientes[0];

  if (!cliente) {
    return (
      <>
        <PageHeader titulo={TITULO} descricao={DESCRICAO} />
        <Card className="items-center py-10 text-sm text-muted-foreground">Cadastre um cliente com pelo menos um sistema primeiro.</Card>
      </>
    );
  }

  // Os participantes são de um sistema do cliente.
  const sistema = cliente.sistemas.find((x) => x.id === sp.sistema) ?? cliente.sistemas[0];
  const [participantes, unidades, contrato] = await Promise.all([
    listarParticipantes(sistema.id, q),
    listarUnidades(cliente.id),
    buscarContratoDoSistemaDoCliente(sistema.id),
  ]);
  const exigeCpf = contrato?.exigeCpf ?? false;
  const setores = [...new Set(unidades.flatMap((u) => u.setores.map((s) => s.nome)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const colunas = exigeCpf ? 7 : 6;
  const ORIGEM = { painel_sinc: "Painel do SINC", campo_reports: "Em campo", cadastro_reports: "Cadastro no ReportS" } as const;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader titulo={TITULO} descricao={DESCRICAO} />
        <ParticipanteDialogo sistemaDoClienteId={sistema.id} exigeCpf={exigeCpf} setores={setores} />
      </div>

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <SeletorParticipantes
          clientes={clientes.map((c) => ({ id: c.id, nome: c.nome, sistemas: c.sistemas.map((x) => ({ id: x.id, nome: x.sistemaNome })) }))}
          clienteAtual={cliente.id}
          sistemaAtual={sistema.id}
        />
        <form className="relative w-full sm:max-w-xs">
          <input type="hidden" name="cliente" value={cliente.id} />
          <input type="hidden" name="sistema" value={sistema.id} />
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Buscar nome, ocupação ou setor" className="h-9 bg-background pl-8" />
        </form>
        <span className="text-xs text-muted-foreground lg:ml-auto">
          {exigeCpf ? "O contrato deste sistema exige CPF." : "O contrato deste sistema não exige CPF."}
        </span>
      </div>

      <Card className="py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Nome</TableHead>
                <TableHead>ID no ERP</TableHead>
                <TableHead>CBO</TableHead>
                <TableHead>Setor</TableHead>
                {exigeCpf && <TableHead>CPF</TableHead>}
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
                  <TableCell className="pl-4">
                    <div className="font-medium">{p.nome}</div>
                    <SeloParticipante estado={p.estado} className="mt-0.5" />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.idErp ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="max-w-56">
                    <span className="font-mono text-xs text-muted-foreground">{formatarCbo(p.cbo.codigo)}</span>
                    <span className="block truncate text-xs">{p.cbo.titulo}</span>
                  </TableCell>
                  <TableCell>{p.setor || "—"}</TableCell>
                  {exigeCpf && <TableCell className="font-mono text-xs">{p.cpf ? formatarCpf(p.cpf) : "—"}</TableCell>}
                  <TableCell>
                    <Badge variant={p.origem === "painel_sinc" ? "outline" : "secondary"}>{ORIGEM[p.origem]}</Badge>
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <ParticipanteDialogo sistemaDoClienteId={sistema.id} exigeCpf={exigeCpf} setores={setores} participante={p} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        {participantes.length} {participantes.length === 1 ? "participante" : "participantes"}. &quot;Em campo&quot; = cadastrado pelo técnico durante uma visita. O CPF completo só aparece aqui, para quem tem a permissão de gerenciar participantes.
      </p>
    </>
  );
}
