"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirTecnicoAcao } from "@/lib/dal";
import { ehPresencial } from "@/lib/visitas";
import { exigeParticipantes } from "@/lib/regras-visita";
import { buscarVisita, encerrarPeloTecnico } from "@/lib/repo/visitas";
import { lerLocal } from "@/lib/ler-local";
import { agendarCepPendente, converterDepois } from "@/lib/cep-visitas";

export interface CheckoutState {
  erros?: Partial<Record<"gps" | "participantes" | "geral", string>>;
}

const TAMANHO_TEXTO = 4000;

export async function fazerCheckout(visitaId: string, _: CheckoutState, fd: FormData): Promise<CheckoutState> {
  const tecnico = await exigirTecnicoAcao();
  const v = await buscarVisita(visitaId);
  if (!v || v.tecnicoId !== tecnico.id) throw new Error("Visita não encontrada");
  if (v.status !== "em_andamento") return { erros: { geral: "Esta visita já foi encerrada." } };

  const erros: NonNullable<CheckoutState["erros"]> = {};
  if (exigeParticipantes(v.tipo) && v.presencas.length === 0) {
    erros.participantes = "Em treinamento, registre ao menos um participante antes do check-out.";
  }

  const checkout = ehPresencial(v.tipo) ? lerLocal(fd, `check-out da visita ${visitaId}`) : null;
  if (ehPresencial(v.tipo) && !checkout) erros.gps = "É preciso a localização do aparelho para o check-out presencial.";
  if (Object.keys(erros).length) return { erros };

  const texto = (nome: string) => String(fd.get(nome) ?? "").trim().slice(0, TAMANHO_TEXTO);
  await encerrarPeloTecnico(visitaId, tecnico.id, {
    checkout,
    observacoes: texto("observacoes"),
    pendencias: texto("pendencias"),
    proximosPassos: texto("proximosPassos"),
  });
  // CEP calculado depois da resposta; aproveita para tentar de novo o do check-in, se ficou sem.
  converterDepois(visitaId, "checkout", checkout);
  agendarCepPendente(v, Date.now());

  revalidatePath("/tecnico", "layout");
  revalidatePath("/admin/visitas", "layout");
  redirect(`/tecnico/visita/${visitaId}?ok=encerrada`);
}
