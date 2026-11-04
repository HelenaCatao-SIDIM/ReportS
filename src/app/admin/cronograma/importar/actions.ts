"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissaoAcao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import type { ContextoImportacao, LinhaBruta, PedidoLinha } from "@/lib/importar-cronograma";
import { LIMITE_ARQUIVO_BYTES, lerPlanilha } from "@/lib/planilha-cronograma";
import { carregarContextoImportacao, gravarImportacao, type ResultadoImportacao } from "@/lib/repo/importar-cronograma";

export type Analise =
  | { ok: true; arquivo: string; linhas: LinhaBruta[]; avisos: string[]; contexto: ContextoImportacao; podeCadastrar: boolean }
  | { ok: false; erro: string };

/** Lê a planilha enviada e devolve as linhas junto com o que existe hoje no sistema, para a prévia. Não grava nada. */
export async function analisarPlanilha(fd: FormData): Promise<Analise> {
  const usuario = await exigirPermissaoAcao(PERMISSOES.contratosGerenciar);
  const arquivo = fd.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, erro: "Escolha o arquivo da planilha (.xlsx)." };
  if (arquivo.size > LIMITE_ARQUIVO_BYTES) return { ok: false, erro: "O arquivo tem mais de 2 MB. Divida a planilha em arquivos menores." };
  const leitura = await lerPlanilha(Buffer.from(await arquivo.arrayBuffer()));
  if (leitura.erro) return { ok: false, erro: leitura.erro };
  return {
    ok: true,
    arquivo: arquivo.name,
    linhas: leitura.linhas,
    avisos: leitura.avisos,
    contexto: await carregarContextoImportacao(),
    podeCadastrar: usuario.permissoes.includes(PERMISSOES.clientesCadastrar),
  };
}

/** Grava o que o usuário aprovou na prévia. Tudo é conferido de novo aqui, e é tudo ou nada. */
export async function confirmarImportacao(pedido: PedidoLinha[]): Promise<ResultadoImportacao> {
  const usuario = await exigirPermissaoAcao(PERMISSOES.contratosGerenciar);
  const resultado = await gravarImportacao(pedido, usuario.permissoes.includes(PERMISSOES.clientesCadastrar));
  if (resultado.ok) revalidatePath("/admin/cronograma");
  return resultado;
}
