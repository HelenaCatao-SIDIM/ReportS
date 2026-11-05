"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissaoAcao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import { urlN8nPermitida } from "@/lib/config-suporte";
import { salvarUrlN8n } from "@/lib/repo/configuracoes";
import { limparCacheSuporte, testarConexaoN8n } from "@/lib/suporte";

export interface ConexaoN8nState {
  /** Resultado do teste de conexão, quando foi pedido. */
  teste?: { ok: boolean; texto: string };
  salvo?: boolean;
  erros?: Partial<Record<"url", string>>;
  /** Endereço digitado, para a tela não perder o que a pessoa escreveu num erro. */
  url?: string;
}

/** Salva o endereço do webhook do n8n e/ou testa a conexão (acao "testar" só testa o que já está guardado). */
export async function salvarConexao(_: ConexaoN8nState, fd: FormData): Promise<ConexaoN8nState> {
  await exigirPermissaoAcao(PERMISSOES.relatoriosGerenciar);
  const acao = String(fd.get("acao") ?? "salvar");
  const url = String(fd.get("url") ?? "").trim();

  if (acao !== "testar") {
    const erros: NonNullable<ConexaoN8nState["erros"]> = {};
    if (!url) erros.url = "Informe o endereço do webhook.";
    else if (url.length > 500) erros.url = "Endereço longo demais.";
    else if (!urlN8nPermitida(url)) erros.url = "Use um endereço https://.";
    if (Object.keys(erros).length) return { erros, url };
    await salvarUrlN8n(url);
    limparCacheSuporte();
    revalidatePath("/admin/configuracoes");
  }

  const r = await testarConexaoN8n();
  limparCacheSuporte();
  return { salvo: acao !== "testar", url, teste: r.ok ? { ok: true, texto: "Conexão funcionando: o n8n respondeu como esperado." } : { ok: false, texto: r.erro } };
}
