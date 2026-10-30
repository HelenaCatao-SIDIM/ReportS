import { Suspense } from "react";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { exigirAdministracao } from "@/lib/dal";
import { sincUrl } from "@/lib/config";
import { CATALOGO } from "@/lib/permissoes";
import { PageHeader } from "@/components/shell/placeholder";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function UsuariosPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
      <Conteudo />
    </Suspense>
  );
}

async function Conteudo() {
  const usuario = await exigirAdministracao();
  const permitidas = new Set(usuario.permissoes);
  const sinc = sincUrl();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader titulo="Usuários e permissões" descricao="O cadastro de pessoas da SIDIM é único, para todos os serviços." />

      <Card>
        <CardHeader>
          <div className="mb-1 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="size-4" />
          </div>
          <CardTitle>Usuários e permissões são gerenciados no SINC</CardTitle>
          <CardDescription>
            Convite, senha, papéis e permissões ficam no Admin do SINC. O ReportS só lê: quem entra, e o que cada pessoa pode fazer aqui, vem de lá.
            Mudanças de papel ou de permissão valem na próxima tela.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a href={sinc} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            Abrir o SINC ({sinc.replace(/^https?:\/\//, "")})
            <ExternalLink className="size-3.5" />
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permissões do ReportS</CardTitle>
          <CardDescription>
            O que cada permissão libera. Você está como <span className="font-medium text-foreground">{usuario.papeis.join(", ") || "sem papel"}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {CATALOGO.map((p) => (
              <li key={p.codigo} className="flex flex-wrap items-start justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="font-mono text-xs">{p.codigo}</div>
                  <div className="text-sm text-muted-foreground">{p.descricao}</div>
                </div>
                <Badge variant={permitidas.has(p.codigo) ? "default" : "outline"}>{permitidas.has(p.codigo) ? "Você tem" : "Você não tem"}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
