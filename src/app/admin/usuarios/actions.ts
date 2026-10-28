"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirGestorAcao } from "@/lib/dal";
import { soDigitos, telefoneValido } from "@/lib/format";
import { atualizarUsuario, criarUsuario, definirAtivo, emailEmUso } from "@/lib/repo/usuarios";
import type { Perfil } from "@/lib/types";

export interface UsuarioFormState {
  erros?: Partial<Record<"nome" | "email" | "telefone" | "senha" | "perfil" | "geral", string>>;
  valores?: { nome: string; email: string; telefone: string; perfil: Perfil; ativo: boolean };
}

const SENHA_MIN = 6;

function ler(formData: FormData) {
  return {
    nome: String(formData.get("nome") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    telefone: soDigitos(String(formData.get("telefone") ?? "")),
    perfil: (formData.get("perfil") === "gestor" ? "gestor" : "tecnico") as Perfil,
    ativo: formData.get("ativo") !== null,
    senha: String(formData.get("senha") ?? ""),
  };
}

async function validar(d: ReturnType<typeof ler>, opts: { id?: string; senhaObrigatoria: boolean }) {
  const erros: NonNullable<UsuarioFormState["erros"]> = {};
  if (d.nome.length < 3) erros.nome = "Informe o nome completo.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) erros.email = "E-mail inválido.";
  else if (await emailEmUso(d.email, opts.id)) erros.email = "Já existe um usuário com este e-mail.";
  if (d.telefone && !telefoneValido(d.telefone)) erros.telefone = "Informe o telefone com DDD, ex.: (19) 99999-0000.";
  if (opts.senhaObrigatoria && !d.senha) erros.senha = "Informe a senha inicial.";
  else if (d.senha && d.senha.length < SENHA_MIN) erros.senha = `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`;
  return erros;
}

export async function criar(_: UsuarioFormState, formData: FormData): Promise<UsuarioFormState> {
  await exigirGestorAcao();
  const d = ler(formData);
  const erros = await validar(d, { senhaObrigatoria: true });
  if (Object.keys(erros).length) return { erros, valores: d };

  await criarUsuario({ nome: d.nome, email: d.email, telefone: d.telefone || null, perfil: d.perfil, ativo: true, senha: d.senha });
  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?ok=criado");
}

export async function editar(id: string, _: UsuarioFormState, formData: FormData): Promise<UsuarioFormState> {
  const atual = await exigirGestorAcao();
  const d = ler(formData);
  const erros = await validar(d, { id, senhaObrigatoria: false });

  // O gestor não pode tirar o próprio acesso.
  if (id === atual.id && (!d.ativo || d.perfil !== "gestor")) {
    erros.geral = "Você não pode inativar a sua própria conta nem mudar o seu perfil.";
  }
  if (Object.keys(erros).length) return { erros, valores: d };

  await atualizarUsuario(id, {
    nome: d.nome,
    email: d.email,
    telefone: d.telefone || null,
    perfil: d.perfil,
    ativo: d.ativo,
    novaSenha: d.senha || undefined,
  });
  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?ok=salvo");
}

export async function alternarAtivo(id: string, ativo: boolean) {
  const atual = await exigirGestorAcao();
  if (id === atual.id) return;
  await definirAtivo(id, ativo);
  revalidatePath("/admin/usuarios");
}
