"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirPermissaoAcao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import { distanciaMetros } from "@/lib/distancia";
import { ehMeio } from "@/lib/meio";
import { ehPresencial } from "@/lib/visitas";
import { buscarUnidade } from "@/lib/repo/clientes";
import { buscarVisita, entrarComoConvidado } from "@/lib/repo/visitas";
import { salvarImagem } from "@/lib/repo/arquivos";
import { lerLocal } from "@/lib/ler-local";
import type { MeioRegistro } from "@/lib/types";

export interface EntrarState {
  erros?: Partial<Record<"gps" | "foto" | "print" | "geral", string>>;
}

const arquivo = (fd: FormData, nome: string) => {
  const f = fd.get(nome);
  return f instanceof File && f.size > 0 ? f : null;
};

/** Check-in do técnico convidado: registra a própria chegada (local + foto) e entra na visita conjunta. */
export async function entrarNaVisita(visitaId: string, _: EntrarState, fd: FormData): Promise<EntrarState> {
  const tecnico = await exigirPermissaoAcao(PERMISSOES.tecnico);
  const v = await buscarVisita(visitaId);
  if (!v) throw new Error("Visita não encontrada");
  if (v.status !== "em_andamento") return { erros: { geral: "Esta visita já foi encerrada." } };
  // Só quem tem um convite pendente para esta visita pode entrar.
  if (!v.tecnicos?.some((t) => t.tecnicoId === tecnico.id && t.estado === "convidado")) {
    return { erros: { geral: "Você não tem um convite pendente para esta visita." } };
  }

  const meioLido = String(fd.get("meio") ?? "");
  const presencial = ehPresencial(v.tipo);
  const checkin = presencial ? lerLocal(fd, `check-in do convidado ${tecnico.id} na visita ${visitaId}`) : null;
  const fotoArquivo = arquivo(fd, presencial ? "fotoAmbiente" : "printTela");

  const erros: NonNullable<EntrarState["erros"]> = {};
  if (!ehMeio(meioLido)) erros.geral = "Não foi possível identificar o aparelho. Atualize a página e tente de novo.";
  if (presencial) {
    if (!checkin) erros.gps = "É preciso a localização do aparelho para entrar numa visita presencial.";
    if (!fotoArquivo) erros.foto = "Tire a foto do ambiente.";
  } else if (!fotoArquivo) {
    erros.print = "Envie o print da tela da reunião.";
  }
  if (Object.keys(erros).length) return { erros };

  const foto = await salvarImagem(fotoArquivo!);
  if (!foto) return { erros: { [presencial ? "foto" : "print"]: "Imagem inválida ou muito grande. Tente de novo." } };

  // Distância do convidado ao estabelecimento: só registrada (alerta para a Administração), nunca impede.
  const unidade = await buscarUnidade(v.unidadeId);
  const distanciaCheckinM =
    checkin && unidade?.latitude != null && unidade.longitude != null
      ? Math.round(distanciaMetros(checkin, { latitude: unidade.latitude, longitude: unidade.longitude }))
      : null;

  try {
    await entrarComoConvidado(visitaId, tecnico.id, {
      checkin,
      meio: meioLido as MeioRegistro,
      distanciaCheckinM,
      raioCheckinM: distanciaCheckinM === null ? null : unidade!.raioMetros,
      fotoAmbiente: presencial ? foto : null,
      printTela: presencial ? null : foto,
    });
  } catch (erro) {
    return { erros: { geral: erro instanceof Error ? erro.message : "Não foi possível entrar na visita." } };
  }

  revalidatePath("/tecnico", "layout");
  revalidatePath("/admin/visitas", "layout");
  redirect(`/tecnico/visita/${visitaId}`);
}
