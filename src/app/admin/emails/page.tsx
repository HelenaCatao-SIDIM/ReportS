import { Suspense } from "react";
import Link from "next/link";
import { FlaskConical, Paperclip } from "lucide-react";
import { listarEmails } from "@/lib/email";
import { formatarDataHora } from "@/lib/datas";
import { PageHeader } from "@/components/shell/placeholder";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { horaDoServidor } from "@/lib/agora";

export default function EmailsPage() {
  return (
    <>
      <PageHeader titulo="Caixa de saída (teste)" descricao="E-mails que o sistema enviaria. Nada sai daqui enquanto o provedor de e-mail não for configurado." />
      <Alert className="mb-4">
        <FlaskConical />
        <AlertDescription>
          Envio simulado. Na fase de integração, estes mesmos e-mails passam a ser enviados de verdade (Resend), e esta tela deixa de existir.
        </AlertDescription>
      </Alert>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <Lista />
      </Suspense>
    </>
  );
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
