import { Suspense } from "react";
import type { Metadata } from "next";
import { CheckCircle2, ChevronDown, ClipboardCheck, Download, History, Info, LinkIcon, MessageSquareWarning } from "lucide-react";
import { buscarPorLink } from "@/lib/repo/relatorios";
import { formatarData, formatarDataHora, formatarDuracao, formatarHora } from "@/lib/datas";
import { formatarCnpj } from "@/lib/format";
import { formatarDataCurta, formatarMinutos, rotuloTipo } from "@/lib/visitas";
import type { Foto, VisitaDetalhada } from "@/lib/types";
import { DetalheVisita } from "@/components/visita/detalhe-visita";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Mudancas } from "@/components/relatorio/mudancas";
import { Decisao } from "./decisao";

export const metadata: Metadata = { title: "Relatório de atendimento · SIDIM", robots: { index: false, follow: false } };

export default function AprovacaoPage({ params, searchParams }: PageProps<"/aprovacao/[token]">) {
  return (
    <div className="min-h-svh bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-2 px-4">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ClipboardCheck className="size-4" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">SIDIM</div>
            <div className="text-xs text-muted-foreground">Relatório de atendimento</div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
          <Conteudo params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

/** Arquivos do sistema passam pelo endereço do link (o aprovador não tem login). */
function viaLink(token: string, v: VisitaDetalhada): VisitaDetalhada {
  const troca = (url: string) => (url.startsWith("/arquivos/") ? `/aprovacao/${token}${url}` : url);
  const foto = (f: Foto | null) => (f ? { ...f, url: troca(f.url) } : null);
  return {
    ...v,
    fotoAmbiente: foto(v.fotoAmbiente),
    printTela: foto(v.printTela),
    fotosExtras: v.fotosExtras.map((f) => ({ ...f, url: troca(f.url) })),
    presencas: v.presencas.map((p) => ({ ...p, assinatura: p.assinatura ? troca(p.assinatura) : null })),
  };
}

function LinkInvalido() {
  return (
    <Card className="items-center gap-3 py-12 text-center">
      <LinkIcon className="size-8 text-muted-foreground" />
      <div className="text-lg font-semibold">Link inválido</div>
      <p className="max-w-sm text-sm text-muted-foreground">Este endereço não corresponde a nenhum relatório. Confira se o link do e-mail foi copiado inteiro.</p>
    </Card>
  );
}

async function Conteudo({ params, searchParams }: Pick<PageProps<"/aprovacao/[token]">, "params" | "searchParams">) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const acesso = await buscarPorLink(token);
  if (!acesso?.versao.conteudo) return <LinkInvalido />;

  const { link, relatorio, versao, ultimaVersao, podeDecidir } = acesso;
  const anterior = relatorio.versoes.find((x) => x.numero === versao.numero - 1);
  const c = versao.conteudo!;
  const visitas = c.visitas.map((v) => viaLink(token, v));
  const decisao = versao.decisao;
  const horas = formatarMinutos(c.minutosPresenciais);
  const pdf = versao.pdfUrl ? `/aprovacao/${token}${versao.pdfUrl}` : null;

  return (
    <div className="space-y-5">
      {sp.ok === "aprovado" && decisao?.tipo === "aprovado" && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
          <CheckCircle2 />
          <AlertDescription className="text-emerald-800">Obrigado! O relatório foi aprovado e a aprovação já aparece para a SIDIM.</AlertDescription>
        </Alert>
      )}
      {sp.ok === "ajuste" && decisao?.tipo === "ajuste" && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-800">
          <MessageSquareWarning />
          <AlertDescription className="text-amber-800">Pedido de ajuste enviado. Você receberá uma nova versão por e-mail.</AlertDescription>
        </Alert>
      )}

      <div>
        <p className="text-sm text-muted-foreground">Olá, {link.aprovadorNome}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{c.cliente.nome}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Período de {formatarDataCurta(c.de)} a {formatarDataCurta(c.ate)} · versão v{versao.numero} · enviada em {formatarDataHora(versao.emitidoEm)}
        </p>
      </div>

      {/* Situação / decisão */}
      {ultimaVersao > versao.numero ? (
        <Alert>
          <Info />
          <AlertDescription>
            Esta é a versão v{versao.numero}, que foi substituída pela v{ultimaVersao}. Use o link do e-mail mais recente para ver e aprovar a versão atual.
          </AlertDescription>
        </Alert>
      ) : decisao ? (
        <Card className={decisao.tipo === "aprovado" ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60"}>
          <CardContent className="flex items-start gap-3">
            {decisao.tipo === "aprovado" ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
            ) : (
              <MessageSquareWarning className="mt-0.5 size-5 shrink-0 text-amber-700" />
            )}
            <div className="text-sm">
              <div className="font-medium">
                {decisao.tipo === "aprovado" ? "Aprovado" : "Ajuste solicitado"} por {decisao.aprovadorNome} em {formatarDataHora(decisao.em)}
              </div>
              {decisao.motivo && <p className="mt-1 text-muted-foreground">“{decisao.motivo}”</p>}
              <p className="mt-1 text-xs text-muted-foreground">Esta página fica disponível apenas para consulta.</p>
            </div>
          </CardContent>
        </Card>
      ) : podeDecidir ? (
        <Card className="border-primary/30">
          <CardContent className="space-y-3">
            <p className="text-sm">
              Confira os atendimentos abaixo e registre sua decisão. <span className="text-muted-foreground">Basta a decisão de um dos aprovadores.</span>
            </p>
            <Decisao token={token} aprovadorNome={link.aprovadorNome} horas={horas} />
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <Info />
          <AlertDescription>Este link não está mais ativo para decisão. A página continua disponível para consulta.</AlertDescription>
        </Alert>
      )}

      {anterior?.conteudo && (
        <Mudancas
          titulo={`O que mudou em relação à v${anterior.numero}`}
          visitas={c.visitas}
          idsAnteriores={anterior.visitaIds}
          visitasAnteriores={anterior.conteudo.visitas}
          desde={anterior.emitidoEm}
          ate={versao.emitidoEm}
        />
      )}

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs text-muted-foreground">CNPJ</div>
            <div className="text-sm">{formatarCnpj(c.cliente.cnpj)}</div>
          </div>
          <div className="sm:col-span-2">
            <div className="text-xs text-muted-foreground">Contrato</div>
            <div className="text-sm">{c.cliente.contrato}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total de horas presenciais</div>
            <div className="text-2xl font-semibold text-primary">{horas}</div>
          </div>
          {c.minutosOnline > 0 && (
            <div>
              <div className="text-xs text-muted-foreground">Treinamento online</div>
              <div className="text-lg font-medium">{formatarMinutos(c.minutosOnline)}</div>
            </div>
          )}
          <div>
            <div className="text-xs text-muted-foreground">Visitas</div>
            <div className="text-lg font-medium">{visitas.length}</div>
          </div>
        </CardContent>
      </Card>

      {pdf && (
        <a href={pdf} className="flex items-center justify-center gap-2 rounded-xl border bg-background p-3 text-sm font-medium text-primary hover:bg-muted/50">
          <Download className="size-4" />
          Baixar o relatório em PDF
        </a>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Atendimentos</h2>
        {visitas.map((v, i) => (
          <details key={v.id} open={i === 0} className="group rounded-xl border bg-card">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-not-open:-rotate-90" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {formatarData(v.entrada)} · {rotuloTipo(v.tipo)}
                  {c.deOutroPeriodo.includes(v.id) && (
                    <Badge variant="secondary">
                      <History />
                      Período anterior
                    </Badge>
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {v.unidadeNome} · {v.setorNome} · {formatarHora(v.entrada)}–{v.saida ? formatarHora(v.saida) : "—"} ({v.saida ? formatarDuracao(v.entrada, v.saida) : "—"})
                </div>
              </div>
            </summary>
            <div className="border-t p-3 sm:p-4">
              <DetalheVisita visita={v} cpf="mascarado" />
            </div>
          </details>
        ))}
      </section>
      <p className="pb-6 text-center text-xs text-muted-foreground">Os CPFs dos participantes aparecem mascarados. Dúvidas? Responda ao e-mail da SIDIM.</p>
    </div>
  );
}
