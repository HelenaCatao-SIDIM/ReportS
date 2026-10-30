/*
 * Tarefa periódica: converte em CEP as coordenadas de check-in e check-out que ficaram sem resultado (o servidor
 * caiu antes da conversão, o serviço de mapas estava fora, ou visitas anteriores à localização por CEP). Usa a mesma
 * conversão das telas, com no máximo 1 consulta por segundo ao Nominatim. Só faz algo com LOCALIZACAO_POR_CEP=true.
 *
 * Roda pelo timer reports-ceps do systemd (deploy/). Uso manual: npm run ceps:preencher
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const LIMITE = Number(process.env.CEPS_POR_EXECUCAO) || 200;

async function principal() {
  if (process.env.LOCALIZACAO_POR_CEP !== "true") {
    console.log("Localização por CEP desligada: nada a fazer.");
    return;
  }
  // Importados depois do .env: o módulo do banco lê as variáveis ao carregar.
  const { resolverCep } = await import("@/lib/cep");
  const { definirEndereco, locaisSemCep } = await import("@/lib/repo/visitas");
  const locais = await locaisSemCep(LIMITE);
  const contagem: Record<string, number> = {};
  for (const { visitaId, momento, local } of locais) {
    const endereco = await resolverCep(local.latitude, local.longitude);
    await definirEndereco(visitaId, momento, endereco);
    contagem[endereco.status] = (contagem[endereco.status] ?? 0) + 1;
  }
  const resumo = Object.entries(contagem).map(([s, n]) => `${n} ${s}`).join(", ");
  console.log(`CEP: ${locais.length} local(is) processado(s)${resumo ? ` (${resumo})` : ""}.`);
}

principal()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { reports, plataforma } = await import("@/lib/db");
    await Promise.all([reports.$disconnect(), plataforma.$disconnect()]);
  });
