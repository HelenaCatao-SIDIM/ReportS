import "server-only";
import { configLoginDoTenant, type ConfigLogin } from "@/lib/saude-login";
import { buscarSistemaDoCliente } from "./clientes";

/** Configuração do login do participante no Saúde para o sistema do cliente (pelo tenant dele), ou null se estiver desligado. */
export async function configLoginDoSistema(sistemaDoClienteId: string): Promise<ConfigLogin | null> {
  const sistema = await buscarSistemaDoCliente(sistemaDoClienteId);
  return configLoginDoTenant(sistema?.tenantId ?? null);
}
