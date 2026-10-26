import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Download, Eye, FileText, Lock, Mail, MessageSquareWarning } from "lucide-react";
import { montarConteudo } from "@/lib/repo/relatorios";
import { formatarDataHora } from "@/lib/datas";
import { formatarDataCurta, formatarMinutos } from "@/lib/visitas";
import { StatusRelatorioBadge } from "@/components/relatorio/status";
import { ConteudoRelatorio, type DadosConteudo } from "@/components/relatorio/conteudo";
import { Mudancas } from "@/components/relatorio/mudancas";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { chamadosSuporte } from "@/lib/config-suporte";
import { buscarResumoSuporte } from "@/lib/suporte";
import { AcoesRascunho } from "./acoes-rascunho";

export default function RelatorioPage({ params, searchParams }: PageProps<"/admin/relatorios/[id]">) {
  return (
    <>
      <Link href="/admin/relatorios" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Relatórios
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Conteudo params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function Mensagem({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  let texto: string | null = null;
  if (sp.ok === "criado") texto = "Rascunho criado. Revise o conteúdo antes de emitir.";
  if (sp.ok === "atualizado") {
    const antes = Number(sp.antes);
    const depois = Number(sp.depois);
    texto = antes === depois ? `Visitas conferidas: nenhuma mudança (${depois}).` : `Visitas atualizadas: ${antes} → ${depois}.`;
  }
  if (sp.ok === "emitido") texto = `Relatório emitido: PDF gerado e e-mail enviado a ${sp.destinatarios} aprovador(es). Veja na Caixa de saída.`;
  if (!texto) return null;
  return (
    <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
      <CheckCircle2 />
      <AlertDescription className="text-emerald-800">{texto}</AlertDescription>
    </Alert>
  );
}

async function Conteudo({ params, searchParams }: Pick<PageProps<"/admin/relatorios/[id]">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const c = await montarConteudo(id);
  if (!c) notFound();
  const { relatorio: r, cliente } = c;
  const editavel = r.status === "rascunho" || r.status === "ajuste_solicitado";
  const ultima = r.versoes.at(-1);

  // Emitido: mostra o conteúdo congelado da última versão (o que o cliente recebeu); em edição, os dados atuais.
  const dados: DadosConteudo =
    !editavel && ultima?.conteudo
      ? ultima.conteudo
      : {
          cliente: { nome: cliente.nome, cnpj: cliente.cnpj, contrato: cliente.contrato },
          de: r.de,
          ate: r.ate,
          visitas: c.visitas,
          deOutroPeriodo: [...c.deOutroPeriodo],
          minutosPresenciais: c.minutosPresenciais,
          minutosOnline: c.minutosOnline,
          // Prévia, buscada agora; na emissão estes números são congelados na versão.
          suporte: chamadosSuporte() ? await buscarResumoSuporte(cliente, r.de, r.ate) : null,
        };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            {cliente.nome}
            <StatusRelatorioBadge status={r.status} />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatarDataCurta(r.de)} a {formatarDataCurta(r.ate)}
            {r.versoes.length > 0 && ` · versão v${r.versoes.length}`} · atualizado em {formatarDataHora(r.atualizadoEm)}
          </p>
        </div>
        {editavel && (
          <AcoesRascunho
            id={r.id}
            podeExcluir={r.status === "rascunho" && r.versoes.length === 0}
            proximaVersao={r.versoes.length + 1}
            aprovadores={cliente.aprovadores.map((a) => ({ nome: a.nome, email: a.email }))}
            visitas={c.visitas.length}
            horas={formatarMinutos(c.minutosPresenciais)}
          />
        )}
      </div>

      <Mensagem sp={sp} />

      {r.status === "ajuste_solicitado" && ultima?.decisao?.tipo === "ajuste" && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <MessageSquareWarning />
          <AlertDescription className="text-amber-900">
            <div className="font-medium">
              {ultima.decisao.aprovadorNome} pediu ajuste na v{ultima.numero} em {formatarDataHora(ultima.decisao.em)}:
            </div>
            <p className="mt-1 italic">“{ultima.decisao.motivo}”</p>
            <p className="mt-2 text-xs">
              Abra as visitas abaixo e use “Corrigir” (o motivo fica no histórico). Se faltou ou sobrou visita, use “Atualizar visitas”. Depois, emita a
              v{r.versoes.length + 1}: os links da v{ultima.numero} deixam de valer e os aprovadores recebem a nova versão.
            </p>
          </AlertDescription>
        </Alert>
      )}
      {r.status === "aprovado" && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
          <Lock />
          <AlertDescription className="text-emerald-800">
            Liberado para faturar: aprovado por {ultima?.decisao?.aprovadorNome} em {ultima?.decisao ? formatarDataHora(ultima.decisao.em) : "—"}. O
            relatório e as visitas estão travados.
          </AlertDescription>
        </Alert>
      )}

      {r.status === "ajuste_solicitado" && ultima?.conteudo && (
        <Mudancas
          titulo={`O que mudou desde a v${ultima.numero} (entrará na v${r.versoes.length + 1})`}
          visitas={c.visitas}
          idsAnteriores={ultima.visitaIds}
          visitasAnteriores={ultima.conteudo.visitas}
          desde={ultima.emitidoEm}
        />
      )}

      {r.versoes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4" />
              Histórico de versões
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {[...r.versoes].reverse().map((v) => (
                <li key={v.numero} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="text-sm">
                    <div className="font-medium">
                      v{v.numero} · emitida em {formatarDataHora(v.emitidoEm)} · {v.visitaIds.length} visita(s)
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="size-3" />
                      {v.enviadoPara.map((p) => p.nome).join(", ")}
                    </div>
                    <div className="mt-1 text-xs">
                      {v.decisao ? (
                        v.decisao.tipo === "aprovado" ? (
                          <span className="text-emerald-700">
                            Aprovada por {v.decisao.aprovadorNome} em {formatarDataHora(v.decisao.em)}
                          </span>
                        ) : (
                          <span className="text-amber-700">
                            Ajuste pedido por {v.decisao.aprovadorNome} em {formatarDataHora(v.decisao.em)}: “{v.decisao.motivo}”
                          </span>
                        )
                      ) : v.numero < r.versoes.length ? (
                        <span className="text-muted-foreground">Substituída pela v{v.numero + 1} sem decisão.</span>
                      ) : (
                        <span className="text-muted-foreground">Aguardando decisão do cliente.</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {v.conteudo && (
                      <Link
                        href={`/admin/relatorios/${r.id}/versoes/${v.numero}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm hover:bg-muted"
                      >
                        <Eye className="size-4" />
                        Ver
                      </Link>
                    )}
                    {v.pdfUrl && (
                      <a
                        href={v.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm hover:bg-muted"
                      >
                        <Download className="size-4" />
                        PDF ({Math.max(1, Math.round(v.pdfTamanho / 1024))} KB)
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <ConteudoRelatorio
        c={dados}
        tituloVisitas={editavel ? (r.versoes.length ? `Visitas para a v${r.versoes.length + 1}` : "Visitas incluídas") : `Visitas da versão v${ultima?.numero}`}
        linkVisitas
      />
      <p className="text-xs text-muted-foreground">
        {editavel
          ? "Prévia do conteúdo como o cliente verá (CPF mascarado). Para corrigir uma visita, abra-a e use “Corrigir”."
          : "Conteúdo exatamente como foi enviado ao cliente."}
      </p>
    </div>
  );
}
