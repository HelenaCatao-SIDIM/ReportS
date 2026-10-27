"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirTecnicoAcao } from "@/lib/dal";
import { distanciaMetros } from "@/lib/distancia";
import { ehMeio } from "@/lib/meio";
import { ehPresencial, TIPOS_VISITA } from "@/lib/visitas";
import { buscarCliente, buscarSetor, buscarUnidade } from "@/lib/repo/clientes";
import { salvarImagem } from "@/lib/repo/arquivos";
import { abrirVisita, visitaAbertaDoTecnico } from "@/lib/repo/visitas";
import type { Coordenadas, MeioRegistro, TipoVisita } from "@/lib/types";

export interface CheckinState {
  erros?: Partial<Record<"cliente" | "unidade" | "setor" | "tipo" | "gps" | "foto" | "print" | "link" | "geral", string>>;
}

function lerCoordenadas(fd: FormData): Coordenadas | null {
  const lat = Number(fd.get("latitude"));
  const lng = Number(fd.get("longitude"));
  const ok = fd.get("latitude") && fd.get("longitude") && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  return ok ? { latitude: lat, longitude: lng } : null;
}

const arquivo = (fd: FormData, nome: string) => {
  const f = fd.get(nome);
  return f instanceof File && f.size > 0 ? f : null;
};

export async function fazerCheckin(_: CheckinState, fd: FormData): Promise<CheckinState> {
  const tecnico = await exigirTecnicoAcao();

  const aberta = await visitaAbertaDoTecnico(tecnico.id);
  if (aberta) return { erros: { geral: "Você já tem uma visita em andamento. Encerre-a antes de abrir outra." } };

  const clienteId = String(fd.get("clienteId") ?? "");
  const unidadeId = String(fd.get("unidadeId") ?? "");
  const setorValor = String(fd.get("setorId") ?? "");
  const setorOutro = String(fd.get("setorOutro") ?? "").trim();
  const tipo = String(fd.get("tipo") ?? "") as TipoVisita;
  const meioLido = String(fd.get("meio") ?? "");

  const erros: NonNullable<CheckinState["erros"]> = {};
  const cliente = await buscarCliente(clienteId);
  if (!cliente?.ativo) erros.cliente = "Escolha o cliente.";
  const unidade = await buscarUnidade(unidadeId);
  if (!unidade || unidade.clienteId !== clienteId) erros.unidade = "Escolha a unidade.";

  let setorId: string | null = null;
  if (setorValor === "outro") {
    if (!setorOutro) erros.setor = "Digite o nome do setor.";
  } else {
    const setor = await buscarSetor(setorValor);
    if (!setor || setor.unidadeId !== unidadeId) erros.setor = "Escolha o setor.";
    else setorId = setor.id;
  }
  if (!TIPOS_VISITA.some((t) => t.valor === tipo)) erros.tipo = "Escolha o tipo de visita.";
  if (!ehMeio(meioLido)) erros.geral = "Não foi possível identificar o aparelho. Atualize a página e tente de novo.";

  const presencial = ehPresencial(tipo);
  const checkin = presencial ? lerCoordenadas(fd) : null;
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

  // A distância é só registrada: fora do raio vira alerta para o gestor, nunca impede o check-in.
  const distanciaCheckinM =
    checkin && unidade?.latitude != null && unidade.longitude != null
      ? Math.round(distanciaMetros(checkin, { latitude: unidade.latitude, longitude: unidade.longitude }))
      : null;

  const v = await abrirVisita({
    tecnicoId: tecnico.id,
    clienteId,
    unidadeId,
    setorId,
    setorOutro: setorId ? null : setorOutro,
    tipo,
    checkin,
    meio: meioLido as MeioRegistro,
    distanciaCheckinM,
    raioCheckinM: distanciaCheckinM === null ? null : unidade!.raioMetros,
    fotoAmbiente: presencial ? foto : null,
    printTela: presencial ? null : foto,
    linkReuniao: presencial ? null : linkReuniao,
  });
  revalidatePath("/tecnico", "layout");
  revalidatePath("/admin/visitas", "layout");
  redirect(`/tecnico/visita/${v.id}`);
}
