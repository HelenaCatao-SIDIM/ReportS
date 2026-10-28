import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FlaskConical, Paperclip } from "lucide-react";
import { listarEmails } from "@/lib/email";
import { formatarDataHora } from "@/lib/datas";
import { PageHeader } from "@/components/shell/placeholder";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { horaDoServidor } from "@/lib/agora";
import { emailReal, emailRedirecionarPara } from "@/lib/config";
import { Badge } from "@/components/ui/badge";

export default function EmailsPage() {
  return (
    <>
      <Cabecalho />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <Lista />
      </Suspense>
    </>
  );
}

function Cabecalho() {
  const real = emailReal();
  const destino = emailRedirecionarPara();
  return (
    <>
      <PageHeader
        titulo={real ? "Caixa de saída" : "Caixa de saída (teste)"}
        descricao={real ? "E-mails enviados pelo sistema, com a situação de cada envio." : "E-mails que o sistema enviaria. Nada sai daqui enquanto o provedor de e-mail não for configurado."}
      />
      {real ? (
        destino && (
          <Alert className="mb-4 border-amber-300 bg-amber-50 text-amber-900">
            <FlaskConical />
            <AlertDescription className="text-amber-900">
              Envio real com <b>trava de teste</b>: todo e-mail está indo para o endereço configurado em <code>EMAIL_REDIRECIONAR_PARA</code>, e não para os aprovadores.
            </AlertDescription>
          </Alert>
        )
      ) : (
        <Alert className="mb-4">
          <FlaskConical />
          <AlertDescription>Envio simulado. Para enviar de verdade, ligue <code>EMAIL_REAL</code> e configure o servidor SMTP (<code>SMTP_HOST</code>, usuário e senha) no servidor.</AlertDescription>
        </Alert>
      )}
    </>
  );
}

function SituacaoBadge({ e }: { e: Awaited<ReturnType<typeof listarEmails>>[number] }) {
  if (e.situacao === "enviado")
    return (
      <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">
        <CheckCircle2 />
        Enviado
      </Badge>
    );
  if (e.situacao === "falhou")
    return (
      <Badge variant="outline" className="border-red-300 bg-red-50 text-red-800">
        <AlertTriangle />
        Falhou
      </Badge>
    );
  return <Badge variant="secondary">Simulado</Badge>;
}

async function Lista() {
  await horaDoServidor(); // leitura sempre na requisição (a caixa muda a cada envio)
  const emails = await listarEmails();
  if (!emails.length) return <Card className="items-center py-10 text-sm text-muted-foreground">Nenhum e-mail enviado ainda.</Card>;

  return (
    <div className="space-y-3">
      {emails.map((e) => (
        <details key={e.id} className="group rounded-xl border bg-card">
          <summary className="cursor-pointer list-none p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{e.assunto}</span>
              <span className="text-xs text-muted-foreground">{formatarDataHora(e.enviadoEm)}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <SituacaoBadge e={e} />
              Para: {e.para.nome} &lt;{e.para.email}&gt;
              {e.anexos.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Paperclip className="size-3" />
                  {e.anexos.length} anexo
                </span>
              )}
            </div>
          </summary>
          <div className="border-t bg-muted/30 p-4">
            {(e.situacao === "falhou" || e.redirecionadoPara || e.idMensagem) && (
              <div className="mx-auto mb-3 max-w-xl space-y-0.5 text-xs text-muted-foreground">
                {e.situacao === "falhou" && <p className="font-medium text-red-700">Motivo da falha: {e.erro}</p>}
                {e.redirecionadoPara && <p>Enviado para {e.redirecionadoPara} (trava de teste), não para o aprovador.</p>}
                {e.idMensagem && <p>Identificador da mensagem: {e.idMensagem}</p>}
              </div>
            )}
            <div className="mx-auto max-w-xl rounded-lg border bg-white p-6 text-sm text-slate-800 shadow-sm">
              {/* Corpo gerado pelo próprio sistema, com nomes escapados (lib/emissao). */}
              <div className="space-y-3 [&_p]:leading-relaxed" dangerouslySetInnerHTML={{ __html: e.html }} />
              {e.botao && (
                <div className="mt-5">
                  <a href={e.botao.url} className="inline-block rounded-lg bg-blue-700 px-5 py-2.5 font-medium text-white">
                    {e.botao.texto}
                  </a>
                  <p className="mt-2 break-all text-xs text-slate-500">{e.botao.url}</p>
                </div>
              )}
              {e.anexos.map((a) => (
                <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="mt-4 flex items-center gap-2 rounded-lg border p-2 text-xs hover:bg-slate-50">
                  <Paperclip className="size-3.5" />
                  {a.nome} · {Math.max(1, Math.round(a.tamanho / 1024))} KB
                </a>
              ))}
            </div>
            {e.relatorioId && (
              <Link href={`/admin/relatorios/${e.relatorioId}`} className="mt-3 inline-block text-xs text-primary hover:underline">
                Abrir o relatório no sistema
              </Link>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
