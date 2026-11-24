"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirPermissaoAcao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import { distanciaMetros, RAIO_PADRAO_METROS } from "@/lib/distancia";
import { ehMeio } from "@/lib/meio";
import { ehPresencial, TIPOS_VISITA } from "@/lib/visitas";
import { equipesDaVisita, rotaDaVisita, sugereTemasPorEquipe } from "@/lib/regras-visita";
import { buscarCliente, buscarUnidade, criarUnidade } from "@/lib/repo/clientes";
import { listarEquipes } from "@/lib/repo/equipes";
import { buscarContrato, listarParaCheckin } from "@/lib/repo/contratos";
import { salvarImagem } from "@/lib/repo/arquivos";
import { abrirVisita, visitaAbertaDoTecnico } from "@/lib/repo/visitas";
import { registrarAuditoria, mudancasDe } from "@/lib/repo/auditoria";
import { resolverCep } from "@/lib/cep";
import { textoEndereco } from "@/lib/format";
import type { MeioRegistro, TipoVisita } from "@/lib/types";
import { lerLocal } from "@/lib/ler-local";
import { converterDepois } from "@/lib/cep-visitas";

export interface CheckinState {
  erros?: Partial<Record<"cliente" | "contrato" | "unidade" | "equipes" | "tipo" | "gps" | "foto" | "print" | "link" | "geral", string>>;
}

const arquivo = (fd: FormData, nome: string) => {
  const f = fd.get(nome);
  return f instanceof File && f.size > 0 ? f : null;
};

export async function fazerCheckin(_: CheckinState, fd: FormData): Promise<CheckinState> {
  const tecnico = await exigirPermissaoAcao(PERMISSOES.tecnico);

  const aberta = await visitaAbertaDoTecnico(tecnico.id);
  if (aberta) return { erros: { geral: "Você já tem uma visita em andamento. Encerre-a antes de abrir outra." } };

  const clienteId = String(fd.get("clienteId") ?? "");
  const contratoId = String(fd.get("contratoId") ?? "");
  const unidadeId = String(fd.get("unidadeId") ?? "");
  const equipesMarcadas = [...new Set(fd.getAll("equipeIds").map(String))];
  const tipo = String(fd.get("tipo") ?? "") as TipoVisita;
  const meioLido = String(fd.get("meio") ?? "");

  const erros: NonNullable<CheckinState["erros"]> = {};
  const cliente = await buscarCliente(clienteId);
  if (!cliente?.ativo) erros.cliente = "Escolha o cliente.";
  // O contrato define o sistema da visita: precisa ser deste cliente e estar ativo.
  const contrato = await buscarContrato(contratoId);
  if (!contrato?.ativo || contrato.clienteId !== clienteId) erros.contrato = "Escolha o sistema.";
  const unidade = await buscarUnidade(unidadeId);
  if (!unidade || unidade.clienteId !== clienteId) erros.unidade = "Escolha o estabelecimento.";

  if (!TIPOS_VISITA.some((t) => t.valor === tipo)) erros.tipo = "Escolha o tipo de visita.";

  // Equipes: nos tipos que registram equipes, as que vão ser treinadas. São as mesmas "equipes
  // treinadas" da visita, que o técnico ajusta até o check-out. Obrigatórias quando há equipe ativa cadastrada.
  let equipeIds: string[] = [];
  if (contrato && sugereTemasPorEquipe(tipo)) {
    const validas = new Set(equipesDaVisita(await listarEquipes(), []).map((e) => e.id));
    equipeIds = equipesMarcadas.filter((id) => validas.has(id));
    if (validas.size && !equipeIds.length) erros.equipes = "Marque as equipes que vão ser treinadas.";
  }
  if (!ehMeio(meioLido)) erros.geral = "Não foi possível identificar o aparelho. Atualize a página e tente de novo.";

  const presencial = ehPresencial(tipo);
  const checkin = presencial ? lerLocal(fd, `check-in do técnico ${tecnico.id}`) : null;
  const linkReuniao = String(fd.get("linkReuniao") ?? "").trim();
  const fotoArquivo = arquivo(fd, presencial ? "fotoAmbiente" : "printTela");

  if (presencial) {
    if (!checkin) erros.gps = "É preciso a localização do aparelho para o check-in presencial.";
    if (!fotoArquivo) erros.foto = "Tire a foto do ambiente.";
  } else if (erros.tipo === undefined) {
    if (!fotoArquivo) erros.print = "Envie o print da tela da reunião.";
    if (!/^https?:\/\/\S+\.\S+/.test(linkReuniao)) erros.link = "Cole o link da reunião (começa com https://).";
  }
  if (Object.keys(erros).length) return { erros };

  const foto = await salvarImagem(fotoArquivo!);
  if (!foto) return { erros: { [presencial ? "foto" : "print"]: "Imagem inválida ou muito grande. Tente de novo." } };

  // A distância é só registrada: fora do raio vira alerta para a administração, nunca impede o check-in.
  const distanciaCheckinM =
    checkin && unidade?.latitude != null && unidade.longitude != null
      ? Math.round(distanciaMetros(checkin, { latitude: unidade.latitude, longitude: unidade.longitude }))
      : null;

  const v = await abrirVisita({
    tecnicoId: tecnico.id,
    clienteId,
    contratoId,
    unidadeId,
    tipo,
    equipeIds,
    checkin,
    meio: meioLido as MeioRegistro,
    distanciaCheckinM,
    raioCheckinM: distanciaCheckinM === null ? null : unidade!.raioMetros,
    fotoAmbiente: presencial ? foto : null,
    printTela: presencial ? null : foto,
    linkReuniao: presencial ? null : linkReuniao,
  });
  // Com a prévia já resolvida, o CEP é gravado na hora; senão, é calculado depois da resposta (o técnico não espera).
  await converterDepois(v.id, "checkin", v.checkin);
  revalidatePath("/tecnico", "layout");
  revalidatePath("/admin/visitas", "layout");
  // Treinamento e implantação abrem pela tela de presença (os participantes assinam enquanto o técnico apresenta); os outros tipos, direto na visita.
  redirect(rotaDaVisita(v));
}

export type NovoEstabelecimentoState =
  | { ok: true; unidade: { id: string; nome: string; endereco: string } }
  | { ok: false; erro: string };

/**
 * Cadastro rápido de um estabelecimento pelo técnico, no próprio check-in, quando o lugar não está na lista. O técnico só
 * digita o nome; a localização vem do GPS do aparelho (ele está no local) e vira a coordenada do estabelecimento — é o
 * ponto mais exato que o sistema terá, e o mesmo sinal que valida o check-in. O endereço é preenchido pelo reverso da
 * coordenada (melhor esforço) e fica editável depois, na Administração. Raio no padrão; sem CNES/código do Saúde. A
 * criação fica registrada na auditoria (origem "App do técnico, no local") para a Administração conferir.
 */
export async function criarEstabelecimentoNoLocal(input: {
  clienteId: string;
  nome: string;
  latitude: number;
  longitude: number;
}): Promise<NovoEstabelecimentoState> {
  const tecnico = await exigirPermissaoAcao(PERMISSOES.tecnico);
  const nome = String(input?.nome ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  const clienteId = String(input?.clienteId ?? "");
  const lat = Number(input?.latitude);
  const lng = Number(input?.longitude);

  if (nome.length < 2) return { ok: false, erro: "Informe o nome do estabelecimento." };
  if (!(Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0))) {
    return { ok: false, erro: "Toque em “Usar minha localização” para marcar o ponto — é preciso estar no local." };
  }

  // Só clientes em que o técnico pode fazer check-in (ativos e com contrato).
  const permitidos = await listarParaCheckin();
  if (!permitidos.some((c) => c.id === clienteId)) return { ok: false, erro: "Cliente indisponível. Atualize a página e tente de novo." };

  // Endereço a partir da coordenada (reverso); melhor esforço: se falhar, fica vazio e a Administração completa depois.
  let endereco = "";
  try {
    const r = await resolverCep(lat, lng);
    if (r.status === "ok" || r.status === "sem_cep") endereco = textoEndereco(r);
  } catch {
    // sem endereço: não impede o cadastro
  }

  const u = await criarUnidade(clienteId, { nome, endereco, latitude: lat, longitude: lng, raioMetros: RAIO_PADRAO_METROS });
  await registrarAuditoria({
    autor: tecnico,
    entidade: "estabelecimento",
    entidadeId: u.id,
    rotulo: nome,
    acao: "criar",
    mudancas: mudancasDe([
      { campo: "Nome", antes: undefined, depois: nome },
      { campo: "Endereço", antes: undefined, depois: endereco },
      { campo: "Latitude", antes: undefined, depois: lat },
      { campo: "Longitude", antes: undefined, depois: lng },
      { campo: "Origem", antes: undefined, depois: "App do técnico, no local" },
    ]),
  });
  revalidatePath("/tecnico", "layout");
  return { ok: true, unidade: { id: u.id, nome: u.nome, endereco: u.endereco } };
}
