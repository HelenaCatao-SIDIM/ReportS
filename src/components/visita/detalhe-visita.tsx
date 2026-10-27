/* eslint-disable @next/next/no-img-element -- fotos do storage; otimização de imagem fica para a fase de banco */
import { ExternalLink, MapPin, PenLine } from "lucide-react";
import type { VisitaDetalhada } from "@/lib/repo/visitas";
import type { Foto } from "@/lib/types";
import { formatarData, formatarDuracao, formatarHora } from "@/lib/datas";
import { formatarCbo, formatarCpf, mascararCpf } from "@/lib/format";
import { ehPresencial, rotuloTipo } from "@/lib/visitas";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function Item({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

function Coordenada({ c }: { c: VisitaDetalhada["checkin"] }) {
  if (!c) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs">
      <MapPin className="size-3" />
      {c.latitude.toFixed(5)}, {c.longitude.toFixed(5)}
    </span>
  );
}

function Fotos({ titulo, fotos }: { titulo: string; fotos: Foto[] }) {
  if (!fotos.length) return null;
  return (
    <div>
      <div className="mb-2 text-xs text-muted-foreground">{titulo}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {fotos.map((f) => (
          <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border">
            <img src={f.url} alt={titulo} className="aspect-[4/3] w-full object-cover" />
          </a>
        ))}
      </div>
    </div>
  );
}

function Texto({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{rotulo}</div>
      <p className={valor ? "mt-0.5 text-sm whitespace-pre-line" : "mt-0.5 text-sm text-muted-foreground"}>{valor || "—"}</p>
    </div>
  );
}

/**
 * Conteúdo completo de uma visita, em modo leitura.
 * `cpf`: "completo" só para o gestor dentro do sistema; nos demais lugares, "mascarado".
 */
export function DetalheVisita({ visita: v, cpf = "mascarado" }: { visita: VisitaDetalhada; cpf?: "completo" | "mascarado" }) {
  const presencial = ehPresencial(v.tipo);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Dados da visita</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Item rotulo="Data">{formatarData(v.entrada)}</Item>
            <Item rotulo="Tipo">{rotuloTipo(v.tipo)}</Item>
            <Item rotulo="Unidade">{v.unidadeNome}</Item>
            <Item rotulo="Setor">
              {v.setorNome}
              {v.setorOutro && <span className="ml-1 text-xs text-muted-foreground">(outro)</span>}
            </Item>
            <Item rotulo="Entrada">{formatarHora(v.entrada)}</Item>
            <Item rotulo="Saída">{v.saida ? formatarHora(v.saida) : "—"}</Item>
            <Item rotulo="Duração">{v.saida ? formatarDuracao(v.entrada, v.saida) : "—"}</Item>
            <Item rotulo="Técnico">{v.tecnicoNome}</Item>
            {presencial ? (
              <>
                <Item rotulo="Local do check-in">
                  <Coordenada c={v.checkin} />
                </Item>
                <Item rotulo="Local do check-out">
                  <Coordenada c={v.checkout} />
                </Item>
              </>
            ) : (
              <div className="sm:col-span-2">
                <Item rotulo="Link da reunião">
                  {v.linkReuniao ? (
                    <a href={v.linkReuniao} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      {v.linkReuniao}
                      <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    "—"
                  )}
                </Item>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Temas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {v.temas.length ? (
              <ul className="space-y-1.5">
                {v.temas.map((t) => (
                  <li key={t.id} className="text-sm">
                    {t.nome}
                    <span className="ml-1 text-xs text-muted-foreground">
                      · {t.sistema} / {t.modulo}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum tema marcado.</p>
            )}
            {v.temaAdicional && <Texto rotulo="Tema adicional" valor={v.temaAdicional} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Encerramento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Texto rotulo="Observações" valor={v.observacoes} />
            <Texto rotulo="Pendências" valor={v.pendencias} />
            <Texto rotulo="Próximos passos" valor={v.proximosPassos} />
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 pb-0">
        <CardHeader className="pb-4">
          <CardTitle>Participantes ({v.presencas.length})</CardTitle>
        </CardHeader>
        {v.presencas.length === 0 ? (
          <CardContent className="pb-4 text-sm text-muted-foreground">Nenhum participante registrado.</CardContent>
        ) : (
          <div className="overflow-x-auto border-t">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Nome</TableHead>
                  <TableHead>CBO</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead className="pr-4">Confirmação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {v.presencas.map((p) => (
                  <TableRow key={p.participanteId}>
                    <TableCell className="pl-4 font-medium">{p.nome}</TableCell>
                    <TableCell className="text-xs">
                      <span className="font-mono text-muted-foreground">{formatarCbo(p.cbo.codigo)}</span> {p.cbo.titulo}
                    </TableCell>
                    <TableCell>{p.setor || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{p.cpf ? (cpf === "completo" ? formatarCpf(p.cpf) : mascararCpf(p.cpf)) : "—"}</TableCell>
                    <TableCell className="pr-4">
                      {p.confirmacao === "assinatura" && p.assinatura ? (
                        <span className="flex items-center gap-2">
                          <Badge variant="secondary">
                            <PenLine />
                            Assinatura
                          </Badge>
                          <img src={p.assinatura} alt={`Assinatura de ${p.nome}`} className="h-8 rounded border bg-white" />
                        </span>
                      ) : (
                        <Badge variant="outline">Nominal</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fotos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Fotos titulo="Foto do ambiente (check-in)" fotos={v.fotoAmbiente ? [v.fotoAmbiente] : []} />
          <Fotos titulo="Print da tela (treinamento online)" fotos={v.printTela ? [v.printTela] : []} />
          <Fotos titulo="Fotos extras" fotos={v.fotosExtras} />
          {!v.fotoAmbiente && !v.printTela && !v.fotosExtras.length && <p className="text-sm text-muted-foreground">Nenhuma foto.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
