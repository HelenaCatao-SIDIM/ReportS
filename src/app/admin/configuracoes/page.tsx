import { Suspense } from "react";
import { situacaoConexaoN8n } from "@/lib/repo/configuracoes";
import { PageHeader } from "@/components/shell/placeholder";
import { ConexaoN8nForm } from "./conexao-n8n-form";

const TITULO = "Configurações";
const DESCRICAO = "Conexões do ReportS com outros sistemas da SIDIM.";

export default function ConfiguracoesPage() {
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
  const situacao = await situacaoConexaoN8n();
  return (
    <>
      <PageHeader titulo={TITULO} descricao={DESCRICAO} />
      <ConexaoN8nForm url={situacao.url} temChave={situacao.temChave} chaveIlegivel={situacao.chaveIlegivel} />
    </>
  );
}
