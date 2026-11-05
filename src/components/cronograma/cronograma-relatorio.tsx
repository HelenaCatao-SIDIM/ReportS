import { CalendarClock } from "lucide-react";
import { resumoCronograma } from "@/lib/cronograma";
import type { CronogramaCongelado } from "@/lib/types";
import { formatarDataCurta, rotuloTipo } from "@/lib/visitas";
import { SituacaoBadgeRelatorio } from "@/components/cronograma/situacao-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Cronograma de implantação do contrato, como foi congelado na emissão (o rascunho mostra a situação de hoje). */
export function CronogramaRelatorio({ cronograma: c }: { cronograma: CronogramaCongelado }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-4" />
          Cronograma de implantação
        </CardTitle>
        <CardDescription>
          {resumoCronograma(c)} · situação em {formatarDataCurta(c.em)}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Estabelecimento</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Atividade</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead className="pr-4">Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {c.itens.map((i, n) => (
                <TableRow key={n}>
                  <TableCell className="pl-4 font-medium">{i.unidadeNome}</TableCell>
                  <TableCell>{i.setorNome ?? <span className="text-muted-foreground">Todos os setores</span>}</TableCell>
                  <TableCell>{rotuloTipo(i.tipo)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatarDataCurta(i.prazo)}</TableCell>
                  <TableCell className="pr-4">
                    <div className="flex flex-col items-start gap-0.5">
                      <SituacaoBadgeRelatorio situacao={i.situacao} />
                      {i.cumpridoEm && <span className="text-xs text-muted-foreground">em {formatarDataCurta(i.cumpridoEm)}</span>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
