"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirTecnicoAcao } from "@/lib/dal";
import { ehPresencial } from "@/lib/visitas";
import { exigeParticipantes } from "@/lib/regras-visita";
import { buscarVisita, encerrarPeloTecnico } from "@/lib/repo/visitas";

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

  let checkout = null;
  if (ehPresencial(v.tipo)) {
    const lat = Number(fd.get("latitude"));
    const lng = Number(fd.get("longitude"));
    if (fd.get("latitude") && fd.get("longitude") && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) checkout = { latitude: lat, longitude: lng };
    else erros.gps = "É preciso a localização do celular para o check-out presencial.";
  }
  if (Object.keys(erros).length) return { erros };

  const texto = (nome: string) => String(fd.get(nome) ?? "").trim().slice(0, TAMANHO_TEXTO);
  await encerrarPeloTecnico(visitaId, tecnico.id, {
    checkout,
    observacoes: texto("observacoes"),
    pendencias: texto("pendencias"),
    proximosPassos: texto("proximosPassos"),
  });

  revalidatePath("/tecnico", "layout");
  revalidatePath("/admin/visitas", "layout");
  redirect(`/tecnico/visita/${visitaId}?ok=encerrada`);
}
