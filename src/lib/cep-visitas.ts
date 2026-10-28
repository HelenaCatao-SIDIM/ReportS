import "server-only";
import { after } from "next/server";
import { localizacaoPorCep } from "@/lib/config";
import { cepEmCache, resolverCep } from "@/lib/cep";
import { definirEndereco } from "@/lib/repo/visitas";
import type { EnderecoVisita, LocalVisita, Visita } from "@/lib/types";

/*
 * Liga o serviço de CEP às visitas: converte depois do check-in/check-out (sem atrasar o técnico),
 * tenta de novo os pendentes ao abrir o detalhe e garante o CEP antes de congelar um relatório.
 *
 * TODO banco: com o banco real, as visitas antigas ganham CEP por um script de preenchimento
 * (mesmo resolverCep, 1 chamada por segundo); a tentativa ao abrir o detalhe continua como rede de segurança.
 */

type Momento = "checkin" | "checkout";
const MOMENTOS: Momento[] = ["checkin", "checkout"];

/** Uma nova tentativa no máximo a cada 10 minutos por visita (evita repetir a cada abertura da tela). */
const ESPERA_NOVA_TENTATIVA_MS = 10 * 60 * 1000;
const g = globalThis as unknown as { __cepTentativas?: Map<string, number> };
const tentativas = (g.__cepTentativas ??= new Map<string, number>());

/** Endereço inicial gravado junto com a coordenada, antes da conversão. */
export function enderecoPendente(): EnderecoVisita {
  return { status: "pendente", cep: null, aproximado: false, logradouro: null, bairro: null, cidade: null, uf: null, fonte: null, atualizadoEm: new Date().toISOString() };
}

/** Precisa converter: tem coordenada e ainda não tem um resultado definitivo. */
export const precisaDeCep = (l: LocalVisita | null) => !!l && (!l.endereco || l.endereco.status === "pendente" || l.endereco.status === "falhou");

async function converter(visitaId: string, momento: Momento, local: LocalVisita) {
  const endereco = await resolverCep(local.latitude, local.longitude);
  await definirEndereco(visitaId, momento, endereco);
}

/**
 * Grava o CEP da coordenada recém-registrada. Se a prévia mostrada ao técnico já resolveu esta coordenada
 * (resultado em cache), grava na hora e a tela da visita já abre com o CEP. Senão, converte depois da resposta,
 * sem atrasar o técnico. Falha nunca bloqueia nada.
 */
export async function converterDepois(visitaId: string, momento: Momento, local: LocalVisita | null) {
  if (!localizacaoPorCep() || !local) return;
  const pronto = cepEmCache(local.latitude, local.longitude);
  if (pronto) {
    await definirEndereco(visitaId, momento, { ...pronto });
    return;
  }
  after(() => converter(visitaId, momento, local).catch((e) => console.error(`[cep] visita ${visitaId} (${momento}):`, e)));
}

/** Algum local ainda sem resultado: o CEP está sendo identificado em segundo plano. */
export function cepEmAndamento(v: Pick<Visita, "checkin" | "checkout">): boolean {
  if (!localizacaoPorCep()) return false;
  return MOMENTOS.some((m) => {
    const local = v[m];
    return !!local && (!local.endereco || local.endereco.status === "pendente");
  });
}

/** Ao abrir o detalhe: se faltar CEP, agenda uma tentativa (no máximo a cada 10 min por visita). `agora` vem da requisição. */
export function agendarCepPendente(v: Pick<Visita, "id" | "checkin" | "checkout">, agora: number) {
  if (!localizacaoPorCep()) return;
  const faltam = MOMENTOS.filter((m) => precisaDeCep(v[m]));
  if (!faltam.length) return;
  const ultima = tentativas.get(v.id) ?? 0;
  if (agora - ultima < ESPERA_NOVA_TENTATIVA_MS) return;
  tentativas.set(v.id, agora);
  after(async () => {
    for (const m of faltam) await converter(v.id, m, v[m]!).catch((e) => console.error(`[cep] visita ${v.id} (${m}):`, e));
  });
}

/**
 * Antes de congelar um relatório: converte, na hora, os locais ainda sem CEP, para a versão enviada
 * ao cliente já sair com o CEP. Respeita a fila do Nominatim (1 por segundo) e o cache.
 * Devolve quantos locais foram convertidos.
 */
export async function preencherCepsPendentes(visitas: Pick<Visita, "id" | "checkin" | "checkout">[]): Promise<number> {
  if (!localizacaoPorCep()) return 0;
  let n = 0;
  for (const v of visitas) {
    for (const m of MOMENTOS) {
      const local = v[m];
      if (!precisaDeCep(local)) continue;
      await converter(v.id, m, local!).catch((e) => console.error(`[cep] visita ${v.id} (${m}):`, e));
      n++;
    }
  }
  return n;
}
