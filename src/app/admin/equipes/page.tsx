import { Suspense } from "react";
import { listarEquipes } from "@/lib/repo/equipes";
import { listarTemas } from "@/lib/repo/temas";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/placeholder";
import { BotaoAtivo } from "@/components/form/botao-ativo";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EquipeDialogo } from "./equipe-dialogo";
import { alternarEquipe } from "./actions";

const TITULO = "Equipes";
const DESCRICAO = "Temas mínimos de cada equipe. Na implantação e nos treinamentos, o técnico marca as equipes e o ReportS sugere esses temas.";

export default function EquipesPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader titulo={TITULO} descricao={DESCRICAO} />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </>
      }
    >
      <Conteudo />
    </Suspense>
  );
}

async function Conteudo() {
  const [equipes, temas] = await Promise.all([listarEquipes(), listarTemas()]);
  const ativas = equipes.filter((e) => e.ativo).length;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader titulo={TITULO} descricao={DESCRICAO} />
        <EquipeDialogo temas={temas} />
      </div>

      <Card className="py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Equipe</TableHead>
                <TableHead>Temas mínimos</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="pr-4 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equipes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    Nenhuma equipe cadastrada.
                  </TableCell>
                </TableRow>
              )}
              {equipes.map((e) => (
                <TableRow key={e.id} className={cn(!e.ativo && "text-muted-foreground")}>
                  <TableCell className="pl-4 font-medium">{e.nome}</TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="flex flex-wrap gap-1">
                      {temas
                        .filter((t) => e.temaIds.includes(t.id))
                        .map((t) => (
                          <Badge key={t.id} variant="secondary" className={cn(!t.ativo && "line-through")} title={`${t.sistema} · ${t.modulo}`}>
                            {t.nome}
                          </Badge>
                        ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={e.ativo ? "outline" : "destructive"}>{e.ativo ? "Ativa" : "Inativa"}</Badge>
                  </TableCell>
                  <TableCell className="pr-4 text-right whitespace-nowrap">
                    <EquipeDialogo equipe={e} temas={temas} />
                    <BotaoAtivo
                      ativo={e.ativo}
                      confirmacao={`Inativar a "${e.nome}"? Ela deixa de aparecer para o técnico, mas continua nas visitas já registradas.`}
                      acao={alternarEquipe.bind(null, e.id, !e.ativo)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        {equipes.length} {equipes.length === 1 ? "equipe" : "equipes"} ({ativas} {ativas === 1 ? "ativa" : "ativas"}). Temas riscados estão inativos e não são sugeridos.
      </p>
    </>
  );
}
