/*
 * Registra o catálogo de permissões do ReportS no banco plataforma (RN-PL-60). Roda no deploy, depois das
 * migrações: inclui as permissões novas, atualiza grupo e descrição das existentes e inativa as do ReportS que
 * saíram do código (deixam de liberar o que liberavam). Rodar de novo não muda nada.
 * O usuário de banco do ReportS só pode gravar estas colunas de `permissions` (ADR-035 do SINC).
 */
import { CATALOGO } from "../src/lib/permissoes";
import { plataforma, rodar } from "./lib/bancos";

const PRODUTO = "reports";

rodar(async () => {
  const codigos = CATALOGO.map((p) => p.codigo as string);
  if (codigos.some((c) => !c.startsWith(`${PRODUTO}.`))) throw new Error(`Toda permissão do ReportS começa com "${PRODUTO}."`);

  await plataforma.$transaction(async (tx) => {
    for (const p of CATALOGO) {
      await tx.$executeRaw`
        INSERT INTO permissions (codigo, produto, grupo, descricao, ativa)
        VALUES (${p.codigo}, ${PRODUTO}, ${p.grupo}, ${p.descricao}, true)
        ON CONFLICT (codigo) DO UPDATE
          SET grupo = EXCLUDED.grupo, descricao = EXCLUDED.descricao, ativa = true, updated_at = now()
          WHERE permissions.grupo IS DISTINCT FROM EXCLUDED.grupo
             OR permissions.descricao IS DISTINCT FROM EXCLUDED.descricao
             OR NOT permissions.ativa`;
    }
    const inativadas = await tx.$executeRaw`
      UPDATE permissions SET ativa = false, updated_at = now()
      WHERE produto = ${PRODUTO} AND ativa AND NOT (codigo = ANY(${codigos}))`;
    console.log(`Catálogo do ReportS registrado: ${codigos.length} permissões ativas${inativadas ? `, ${inativadas} inativada(s)` : ""}.`);
  });
});
