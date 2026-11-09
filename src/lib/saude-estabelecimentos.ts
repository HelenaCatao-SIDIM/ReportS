import "server-only";

/*
 * Estabelecimentos cadastrados no SIDIM Saúde de um cliente (GET {api}/api/estabelecimentos).
 *
 * O endereço da API vem do diretório de servidores (enderecoApiDoTenant, em saude-login.ts). A API pede login
 * (POST {api}/api/login, o mesmo do participante) e devolve todos os estabelecimentos de uma vez, sem filtro nem paginação:
 *   [{ codigo, nomePosto, cnes, cep, logradouro, codigo_municipio, idUsuario }]
 * Por enquanto, quem busca digita um usuário e uma senha do Saúde na hora: a senha passa só pela memória e o token também
 * (nenhum dos dois é gravado, registrado em log ou devolvido ao navegador).
 */

export interface EstabelecimentoSaude {
  /** Id do estabelecimento no Saúde (`codigo`). */
  codigo: string;
  nome: string;
  /** Vazio quando o Saúde não tem o CNES. */
  cnes: string;
  cep: string;
  logradouro: string;
  /** Código IBGE do município; vazio quando o Saúde não tem. */
  municipio: string;
  /** Da ficha do CNES (src/lib/cnes.ts), quando o item tem CNES e a ficha respondeu; vazios/nulos sem ela. */
  cnesNome: string;
  cnesEndereco: string;
  latitude: number | null;
  longitude: number | null;
}

export type ResultadoEstabelecimentos =
  | { ok: true; itens: EstabelecimentoSaude[] }
  | { ok: false; motivo: "credenciais" | "indisponivel" };

const TIMEOUT_MS = 15_000;

/** Texto limpo: sem espaços e tabs sobrando (o Saúde tem nomes com tab no fim). Número vira texto; o resto vira vazio. */
const texto = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? String(v) : typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

/** A lista da API. `undefined` = a resposta não é uma lista. Itens sem código ou sem nome ficam de fora. */
export function lerEstabelecimentos(json: unknown): EstabelecimentoSaude[] | undefined {
  if (!Array.isArray(json)) return undefined;
  return json.flatMap((item): EstabelecimentoSaude[] => {
    if (!item || typeof item !== "object") return [];
    const o = item as Record<string, unknown>;
    const codigo = texto(o.codigo);
    const nome = texto(o.nomePosto);
    if (!codigo || !nome) return [];
    return [
      {
        codigo,
        nome,
        cnes: texto(o.cnes),
        cep: texto(o.cep),
        logradouro: texto(o.logradouro),
        municipio: texto(o.codigo_municipio),
        cnesNome: "",
        cnesEndereco: "",
        latitude: null,
        longitude: null,
      },
    ];
  });
}

const opcoes = { cache: "no-store", redirect: "error" } as const;

/** Token de acesso da API, ou o motivo da falha ("credenciais" = a API recusou o usuário e a senha). */
async function tokenDoSaude(url: string, usuario: string, senha: string): Promise<{ token: string } | { motivo: "credenciais" | "indisponivel" }> {
  const r = await fetch(`${url}/api/login`, {
    ...opcoes,
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "password", username: usuario, password: senha }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (r.status === 400 || r.status === 401 || r.status === 403) return { motivo: "credenciais" };
  if (!r.ok) return { motivo: "indisponivel" };
  const corpo = (await r.json().catch(() => null)) as Record<string, unknown> | null;
  const token = typeof corpo?.access_token === "string" ? corpo.access_token : "";
  return token ? { token } : { motivo: "indisponivel" };
}

/** Entra na API do Saúde do cliente com o usuário e a senha informados e traz a lista de estabelecimentos. */
export async function buscarEstabelecimentosNoSaude(url: string, usuario: string, senha: string): Promise<ResultadoEstabelecimentos> {
  try {
    const login = await tokenDoSaude(url, usuario, senha);
    if (!("token" in login)) return { ok: false, motivo: login.motivo };
    const r = await fetch(`${url}/api/estabelecimentos`, {
      ...opcoes,
      headers: { Authorization: `Bearer ${login.token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!r.ok) return { ok: false, motivo: "indisponivel" };
    const itens = lerEstabelecimentos(await r.json().catch(() => undefined));
    return itens ? { ok: true, itens } : { ok: false, motivo: "indisponivel" };
  } catch {
    return { ok: false, motivo: "indisponivel" };
  }
}
