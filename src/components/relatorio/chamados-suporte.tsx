import { ChevronDown, Headset } from "lucide-react";
import type { ContagemSuporte, ResumoSuporte } from "@/lib/types";
import { formatarDataHora } from "@/lib/datas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Top N e o resto somado em "Outros". */
export function topComOutros(lista: ContagemSuporte[], n = 5): ContagemSuporte[] {
  if (lista.length <= n) return lista;
  const resto = lista.slice(n).reduce((s, x) => s + x.quantidade, 0);
  return [...lista.slice(0, n), { nome: "Outros", quantidade: resto }];
}

/** "2026-10-05 09:00:00" → "05/10/2026 09:00" (texto do Fortics, já no horário de Brasília). */
function dataFortics(s: string) {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : s || "—";
}

function Tabela({ titulo, itens }: { titulo: string; itens: ContagemSuporte[] }) {
  if (!itens.length) return null;
  return (
    <div>
      <div className="mb-1.5 text-xs text-muted-foreground">{titulo}</div>
      <ul className="divide-y rounded-lg border text-sm">
        {itens.map((x) => (
          <li key={x.nome} className="flex items-center justify-between gap-3 px-3 py-1.5">
            <span className="min-w-0 truncate">{x.nome}</span>
            <span className="shrink-0 font-medium tabular-nums">{x.quantidade}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Bloco "Chamados de suporte" do relatório.
 * `publico="aprovador"`: só totais e tabelas (sem a lista de chamados e sem nome de agente);
 * cliente sem vínculo com o SINC não mostra nada para o aprovador.
 */
export function ChamadosSuporte({ resumo: r, publico }: { resumo: ResumoSuporte; publico: "administracao" | "aprovador" }) {
  if (publico === "aprovador" && r.situacao === "sem_vinculo") return null;

  let corpo: React.ReactNode;
  if (r.situacao === "sem_vinculo") {
    corpo = <p className="text-sm text-muted-foreground">Cliente sem vínculo com o SINC. Informe o “Nome no SINC” no cadastro do cliente.</p>;
  } else if (r.situacao === "indisponivel") {
    corpo = <p className="text-sm text-muted-foreground">Dados de suporte indisponíveis no momento.</p>;
  } else if (r.totalAbertosEFechados === 0) {
    corpo = <p className="text-sm text-muted-foreground">Nenhum chamado no período.</p>;
  } else {
    corpo = (
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
          <div>
            <div className="text-2xl font-semibold">{r.totalAbertosEFechados}</div>
            <div className="text-xs text-muted-foreground">{r.totalAbertosEFechados === 1 ? "chamado aberto e fechado" : "chamados abertos e fechados"} no período</div>
          </div>
          {r.tempoMedioEsperaMin !== null && (
            <div>
              <div className="text-lg font-medium">{r.tempoMedioEsperaMin.toLocaleString("pt-BR")} min</div>
              <div className="text-xs text-muted-foreground">espera média pelo atendente</div>
            </div>
          )}
        </div>
        {publico === "administracao" && r.sistemaFiltro !== undefined && (
          <p className="text-xs text-muted-foreground">
            {r.sistemaFiltro
              ? `Só os chamados do sistema ${r.sistemaFiltro} no Fortics.`
              : "Todos os sistemas do cliente: este sistema não tem “Nome no Fortics” cadastrado no SINC (Configurações > Sistemas). Se o cliente tem mais de um sistema, o número se repete nos relatórios de cada um."}
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          <Tabela titulo="Por sistema" itens={topComOutros(r.porSistema)} />
          <Tabela titulo="Por assunto" itens={topComOutros(r.porTopico)} />
          <Tabela titulo="Por motivo de encerramento" itens={topComOutros(r.porMotivoEncerramento)} />
        </div>
        {publico === "administracao" && r.chamados.length > 0 && (
          <details className="group rounded-lg border">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium">
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-not-open:-rotate-90" />
              Ver os {r.chamados.length} chamados
            </summary>
            <div className="overflow-x-auto border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-3">Protocolo</TableHead>
                    <TableHead>Abertura</TableHead>
                    <TableHead>Encerramento</TableHead>
                    <TableHead>Sistema</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead className="pr-3">Atendente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.chamados.map((ch) => (
                    <TableRow key={ch.protocolo}>
                      <TableCell className="pl-3 font-mono text-xs">{ch.protocolo}</TableCell>
                      <TableCell className="text-xs">{dataFortics(ch.abertura)}</TableCell>
                      <TableCell className="text-xs">{dataFortics(ch.encerramento)}</TableCell>
                      <TableCell>{ch.sistema || "—"}</TableCell>
                      <TableCell>{ch.topico || "—"}</TableCell>
                      <TableCell className="pr-3">{ch.agente || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </details>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Headset className="size-4" />
          Chamados de suporte
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {corpo}
        {r.situacao === "ok" && <p className="text-xs text-muted-foreground">Fonte: atendimentos do suporte (Fortics), consultados em {formatarDataHora(r.consultadoEm)}.</p>}
      </CardContent>
    </Card>
  );
}
