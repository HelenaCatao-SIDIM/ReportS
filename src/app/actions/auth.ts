"use server";

import { redirect } from "next/navigation";
import { autenticar } from "@/lib/repo/usuarios";
import { createSession, deleteSession } from "@/lib/session";
import { HOME } from "@/lib/dal";

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

  await createSession(usuario.id, usuario.perfil);
  redirect(HOME[usuario.perfil]);
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
