import "server-only";
import { normalizar } from "@/lib/format";

/*
 * API do SIDIM Saúde (o ERP do cliente), para importar estabelecimentos e profissionais. Cada tenant tem o seu
 * endereço e o seu usuário de serviço, no .env do servidor (a senha nunca vai para o banco nem para a tela):
 *   SAUDE_API_<TENANT>_URL, SAUDE_API_<TENANT>_USUARIO e SAUDE_API_<TENANT>_SENHA
 * com o tenant em maiúsculas e sem símbolos (saude_parademinas → SAUDE_API_SAUDE_PARADEMINAS_URL).
 *
 * O endereço é o da API do tenant (ex.: http://sidim.no-ip.net/api_parademinas), não o do sistema web.
 * Fluxo (conferido com a API de Pará de Minas em 04/11/2026):
 *   POST /api/login, formulário grant_type=password&username&password → { access_token, token_type, userId, ... }
 *   GET  /api/funcionario com "Authorization: Bearer" → [{ codigo, nome, cargo, cns, municipio, usuario, email, idUsuario }]
 * A lista não traz CPF, código CBO nem estabelecimentos: a leitura já aceita esses campos (nas grafias prováveis) para
 * quando a API passar a mandá-los, e ignora o que não reconhecer. O `cargo` é texto livre e não vira CBO.
 */

const TIMEOUT_MS = 60_000;

export interface AcessoSaude {
  url: string;
  usuario: string;
  senha: string;
}

export interface EstabelecimentoSaude {
  idErp: string;
  nome: string;
  endereco: string;
}

export interface FuncionarioSaude {
  idFuncionario: string;
  /** Id do usuário do ERP; é o mesmo que o SINC grava nos participantes confirmados. Null = funcionário sem usuário. */
  idUsuario: string | null;
  usuarioAtivo: boolean;
  nome: string;
  cpf: string | null;
  /** Códigos CBO de 6 dígitos, sem repetir. */
  cbos: string[];
  estabelecimentos: EstabelecimentoSaude[];
}

export class ErroSaude extends Error {}

/** "saude_parademinas" → "SAUDE_API_SAUDE_PARADEMINAS". */
export const prefixoDoTenant = (tenant: string) => `SAUDE_API_${normalizar(tenant).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "")}`;

/** Acesso configurado para o tenant, ou null se faltar alguma das três variáveis. */
export function acessoDoTenant(tenant: string | null, env: Record<string, string | undefined> = process.env): AcessoSaude | null {
  if (!tenant?.trim()) return null;
  const p = prefixoDoTenant(tenant);
  const url = env[`${p}_URL`]?.trim().replace(/\/+$/, "");
  const usuario = env[`${p}_USUARIO`]?.trim();
  const senha = env[`${p}_SENHA`];
  return url && usuario && senha ? { url, usuario, senha } : null;
}

// ---------- Leitura da resposta ----------

type Objeto = Record<string, unknown>;
const objeto = (v: unknown): Objeto | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Objeto) : null);

/** Primeiro campo presente entre as grafias aceitas (compara sem diferenciar maiúsculas). */
function campo(o: Objeto, ...nomes: string[]): unknown {
  for (const n of nomes) {
    const chave = Object.keys(o).find((k) => k.toLowerCase() === n.toLowerCase());
    if (chave !== undefined && o[chave] !== null && o[chave] !== undefined) return o[chave];
  }
  return undefined;
}

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const id = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? String(v) : typeof v === "string" && v.trim() ? v.trim() : null);
const soDigitos = (v: string) => v.replace(/\D/g, "");

/** CPF só com os dígitos; qualquer coisa sem 11 dígitos vira null (a validação dos dígitos verificadores fica para quem grava). */
function lerCpf(o: Objeto): string | null {
  const d = soDigitos(texto(campo(o, "cpf", "numeroCpf", "cpfNumero")));
  return d.length === 11 ? d : null;
}

/** CBO de 6 dígitos, venha como texto, número ou objeto ({ codigo }, { cbo: { codigo } }). */
function lerCbo(v: unknown): string | null {
  const o = objeto(v);
  if (!o) {
    const d = soDigitos(texto(v));
    return d.length === 6 ? d : null;
  }
  const interno = objeto(campo(o, "cbo"));
  if (interno) return lerCbo(interno);
  return lerCbo(campo(o, "codigo", "codigoCbo", "cboCodigo", "cbo", "id"));
}

function lerEndereco(o: Objeto): string {
  const pronto = texto(campo(o, "endereco", "enderecoCompleto"));
  if (pronto) return pronto;
  const partes = [
    [texto(campo(o, "logradouro", "rua")), texto(campo(o, "numero"))].filter(Boolean).join(", "),
    texto(campo(o, "bairro")),
    [texto(campo(o, "cidade", "municipio")), texto(campo(o, "uf"))].filter(Boolean).join("/"),
  ].filter(Boolean);
  return partes.join(" — ");
}

/** Estabelecimento direto ou dentro da ligação ({ estabelecimento: {...} }). */
function lerEstabelecimento(v: unknown): EstabelecimentoSaude | null {
  const o = objeto(v);
  if (!o) return null;
  const interno = objeto(campo(o, "estabelecimento"));
  if (interno) return lerEstabelecimento(interno);
  const idErp = id(campo(o, "id", "estabelecimentoId"));
  const nome = texto(campo(o, "nome", "nomeFantasia", "razaoSocial", "descricao"));
  return idErp && nome ? { idErp, nome, endereco: lerEndereco(o) } : null;
}

const lista = (v: unknown) => (Array.isArray(v) ? v : []);

/** Um funcionário da resposta. Sem id ou sem nome, é ignorado. */
export function lerFuncionario(v: unknown): FuncionarioSaude | null {
  const o = objeto(v);
  if (!o) return null;
  const idFuncionario = id(campo(o, "codigo", "id", "idFuncionario"));
  const nome = texto(campo(o, "nome"));
  if (!idFuncionario || !nome) return null;

  // O usuário vem como objeto ({ id, ativo }) ou só como o id (idUsuario); o campo "usuario" texto é o login.
  const usuario = objeto(campo(o, "usuario"));
  const idUsuario = usuario ? id(campo(usuario, "id")) : id(campo(o, "idUsuario", "usuarioId"));
  const ativo = usuario ? campo(usuario, "ativo") : undefined;

  const cbos = [...new Set([...lista(campo(o, "cbos", "funcionarioCbos")).map(lerCbo), lerCbo(campo(o, "cbo"))].filter((c): c is string => !!c))];
  const vistos = new Set<string>();
  const estabelecimentos = lista(campo(o, "estabelecimentos", "funcionarioEstabelecimentos"))
    .map(lerEstabelecimento)
    .filter((e): e is EstabelecimentoSaude => !!e && !vistos.has(e.idErp) && !!vistos.add(e.idErp));

  return { idFuncionario, idUsuario, usuarioAtivo: ativo !== false, nome, cpf: lerCpf(o), cbos, estabelecimentos };
}

/** A lista de funcionários. `undefined` = a resposta não é uma lista (formato inesperado). */
export function lerFuncionarios(json: unknown): FuncionarioSaude[] | undefined {
  if (!Array.isArray(json)) return undefined;
  return json.map(lerFuncionario).filter((f): f is FuncionarioSaude => !!f);
}

/** Token da resposta do login: { access_token } (OAuth), { token } ou dentro de { usuario: { token } } / { data: { token } }. */
export function lerToken(json: unknown): string | null {
  const o = objeto(json);
  if (!o) return null;
  const direto = texto(campo(o, "access_token", "token", "accessToken"));
  if (direto) return direto;
  for (const dentro of ["usuario", "user", "data"]) {
    const interno = objeto(campo(o, dentro));
    const t = interno ? texto(campo(interno, "token", "accessToken")) : "";
    if (t) return t;
  }
  return null;
}

// ---------- Chamadas ----------

async function chamar(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch {
    throw new ErroSaude("A API do Saúde não respondeu. Confira o endereço configurado e tente de novo em instantes.");
  }
}

async function entrar(acesso: AcessoSaude): Promise<string> {
  const r = await chamar(`${acesso.url}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "password", username: acesso.usuario, password: acesso.senha }),
  });
  if (!r.ok) throw new ErroSaude("O Saúde recusou o login do usuário de integração. Confira o usuário e a senha configurados.");
  const token = lerToken(await r.json().catch(() => null));
  if (!token) throw new ErroSaude("O login no Saúde não devolveu o token esperado.");
  return token;
}

/** Os funcionários que a API devolve ao usuário de integração (a API não pagina). */
export async function buscarFuncionarios(acesso: AcessoSaude): Promise<FuncionarioSaude[]> {
  const token = await entrar(acesso);
  const r = await chamar(`${acesso.url}/api/funcionario`, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
  if (r.status === 401 || r.status === 403) throw new ErroSaude("O usuário de integração não tem permissão para listar os funcionários no Saúde.");
  if (!r.ok) throw new ErroSaude(`A API do Saúde respondeu com erro (${r.status}) ao listar os funcionários.`);
  const lidos = lerFuncionarios(await r.json().catch(() => undefined));
  if (!lidos) throw new ErroSaude("A lista de funcionários do Saúde veio num formato inesperado.");
  return lidos;
}
