"use server";

import { redirect } from "next/navigation";
import { autenticar } from "@/lib/repo/usuarios";
import { createSession, deleteSession } from "@/lib/session";
import { destinoAposLogin } from "@/lib/permissoes";

export interface LoginState {
  erro?: string;
  email?: string;
}

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");

  if (!email || !senha) return { erro: "Informe e-mail e senha.", email };

  const usuario = await autenticar(email, senha);
  if (!usuario) return { erro: "E-mail ou senha inválidos.", email };

  // Quem não tem nenhuma permissão do ReportS não entra (RN-PL-61).
  const destino = destinoAposLogin(usuario.permissoes);
  if (!destino) return { erro: "Seu usuário não tem acesso ao ReportS. Fale com a coordenação.", email };

  await createSession(usuario.id);
  redirect(destino);
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
