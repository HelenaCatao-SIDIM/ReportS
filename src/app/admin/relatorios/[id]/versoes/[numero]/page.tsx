import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Mail } from "lucide-react";
import { buscarRelatorio } from "@/lib/repo/relatorios";
import { buscarCliente } from "@/lib/repo/clientes";
import { formatarDataHora } from "@/lib/datas";
import { formatarDataCurta } from "@/lib/visitas";
import { ConteudoRelatorio } from "@/components/relatorio/conteudo";
import { Mudancas } from "@/components/relatorio/mudancas";
import { Card, CardContent } from "@/components/ui/card";

export default function VersaoPage({ params }: PageProps<"/admin/relatorios/[id]/versoes/[numero]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Conteudo params={params} />
    </Suspense>
  );
}

async function Conteudo({ params }: Pick<PageProps<"/admin/relatorios/[id]/versoes/[numero]">, "params">) {
  const { id, numero } = await params;
  const r = await buscarRelatorio(id);
  const v = r?.versoes.find((x) => x.numero === Number(numero));
  if (!r || !v?.conteudo) notFound();
  const cliente = await buscarCliente(r.clienteId);
  const anterior = r.versoes.find((x) => x.numero === v.numero - 1);

  return (
    <div className="space-y-6">
      <Link href={`/admin/relatorios/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Relatório atual
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {cliente?.nome} · versão v{v.numero}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatarDataCurta(r.de)} a {formatarDataCurta(r.ate)} · emitida em {formatarDataHora(v.emitidoEm)} · conteúdo congelado como foi enviado
          </p>
        </div>
        {v.pdfUrl && (
          <a href={v.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-sm hover:bg-muted">
            <Download className="size-4" />
            PDF da v{v.numero}
          </a>
        )}
      </div>

      <Card>
        <CardContent className="space-y-1 text-sm">
          <div className="flex flex-wrap items-center gap-1 text-muted-foreground">
            <Mail className="size-3.5" />
            Enviada para {v.enviadoPara.map((p) => `${p.nome} (${p.email})`).join(", ")}
          </div>
          <div>
            {v.decisao
              ? `${v.decisao.tipo === "aprovado" ? "Aprovada" : "Ajuste pedido"} por ${v.decisao.aprovadorNome} em ${formatarDataHora(v.decisao.em)}${v.decisao.motivo ? `: “${v.decisao.motivo}”` : ""}`
              : v.numero < r.versoes.length
                ? `Substituída pela v${v.numero + 1} sem decisão.`
                : "Aguardando decisão do cliente."}
          </div>
        </CardContent>
      </Card>

      {anterior?.conteudo && (
        <Mudancas
          titulo={`Mudanças em relação à v${anterior.numero}`}
          visitas={v.conteudo.visitas}
          idsAnteriores={anterior.visitaIds}
          visitasAnteriores={anterior.conteudo.visitas}
          desde={anterior.emitidoEm}
          ate={v.emitidoEm}
        />
      )}

      <ConteudoRelatorio c={v.conteudo} tituloVisitas={`Visitas da v${v.numero}`} linkVisitas={false} />
    </div>
  );
}
