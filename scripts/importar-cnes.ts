/*
 * Tarefa periódica: importa do CNES os estabelecimentos dos clientes prefeitura que ainda estão sem nenhum. Deduz o
 * município pelo nome do cliente (quando o nome resolve um único município) e traz a rede municipal (gestão municipal +
 * natureza pública). É o que faz o cliente novo vindo do SINC "puxar sozinho": o SINC não avisa quando entra cliente,
 * então o timer passa de tempos em tempos e pega quem está vazio. Clientes já com estabelecimentos, e nomes ambíguos
 * (homônimo entre estados) ou que não são prefeitura, ficam de fora — esses dependem do botão na tela.
 *
 * Roda pelo timer reports-cnes do systemd (deploy/). Uso manual: npm run cnes:importar
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

/** Teto de clientes por execução (busca no CNES é lenta: dezenas de fichas por cliente). O timer seguinte pega o resto. */
const LIMITE = Number(process.env.CNES_CLIENTES_POR_EXECUCAO) || 20;

async function principal() {
  // Importados depois do .env: o módulo do banco lê as variáveis ao carregar.
  const { listarClientes } = await import("@/lib/repo/clientes");
  const { resolverMunicipioPorCliente } = await import("@/lib/municipio-por-nome");
  const { importarRedeMunicipal } = await import("@/lib/repo/cnes-importacao");

  const clientes = await listarClientes("");
  const vazios = clientes.filter((c) => c.ativo && c.totalUnidades === 0);

  let processados = 0;
  let incluidosTotal = 0;
  let atualizadosTotal = 0;
  let falhas = 0;
  for (const cliente of vazios) {
    if (processados >= LIMITE) break;
    const r = resolverMunicipioPorCliente(cliente.nome);
    if (!r || !("municipio" in r)) continue; // ambíguo, desconhecido ou não-prefeitura: fica para o botão
    const mun = r.municipio;
    processados++;
    try {
      const imp = await importarRedeMunicipal(cliente.id, mun.codigo);
      if (imp) {
        incluidosTotal += imp.incluidos;
        atualizadosTotal += imp.atualizados;
        console.log(`  ${cliente.nome} (${mun.nome}): ${imp.incluidos} novos, ${imp.atualizados} atualizados`);
      } else {
        falhas++;
        console.log(`  ${cliente.nome} (${mun.nome}): o CNES não devolveu a rede municipal`);
      }
    } catch (e) {
      falhas++;
      console.log(`  ${cliente.nome} (${mun.nome}): falhou (${e instanceof Error ? e.message : e})`);
    }
  }

  if (processados === 0) console.log("CNES: nenhuma prefeitura sem estabelecimento a processar.");
  else console.log(`CNES: ${processados} cliente(s), ${incluidosTotal} incluídos, ${atualizadosTotal} atualizados${falhas ? `, ${falhas} sem sucesso` : ""}.`);
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
