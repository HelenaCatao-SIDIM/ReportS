"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import type { UsuarioFormState } from "./actions";
import type { UsuarioPublico } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, selectClass } from "@/components/form/campo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

type Acao = (state: UsuarioFormState, formData: FormData) => Promise<UsuarioFormState>;

export function UsuarioForm({ acao, usuario, ehVoceMesmo }: { acao: Acao; usuario?: UsuarioPublico; ehVoceMesmo?: boolean }) {
  const [state, action, pending] = useActionState(acao, {});
  const v = state.valores ?? usuario;
  const e = state.erros ?? {};
  const edicao = !!usuario;

  return (
    <Card className="max-w-2xl">
      <CardContent>
        {/* key força o formulário a reaplicar os valores devolvidos após um erro */}
        <form action={action} noValidate key={JSON.stringify(state.valores ?? {})} className="space-y-5">
          {e.geral && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{e.geral}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Campo id="nome" label="Nome" erro={e.nome}>
                <Input id="nome" name="nome" defaultValue={v?.nome} aria-invalid={!!e.nome} className="h-9" />
              </Campo>
            </div>
            <Campo id="email" label="E-mail" erro={e.email} dica="Usado para entrar no sistema.">
              <Input id="email" name="email" type="email" defaultValue={v?.email} aria-invalid={!!e.email} className="h-9" />
            </Campo>
            <Campo id="perfil" label="Perfil" dica="Técnico usa o app de campo; gestor, a Administração.">
              <select
                id="perfil"
                name="perfil"
                defaultValue={v?.perfil ?? "tecnico"}
                disabled={ehVoceMesmo}
                className={selectClass}
              >
                <option value="tecnico">Técnico</option>
                <option value="gestor">Gestor</option>
              </select>
              {ehVoceMesmo && <input type="hidden" name="perfil" value="gestor" />}
            </Campo>
            <Campo
              id="senha"
              label={edicao ? "Nova senha" : "Senha inicial"}
              erro={e.senha}
              dica={edicao ? "Deixe em branco para manter a senha atual." : "Mínimo de 6 caracteres. Repasse ao usuário."}
            >
              <Input id="senha" name="senha" type="password" autoComplete="new-password" aria-invalid={!!e.senha} className="h-9" />
            </Campo>
            {edicao && (
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="ativo"
                    defaultChecked={v?.ativo}
                    disabled={ehVoceMesmo}
                    className="size-4 accent-primary"
                  />
                  Usuário ativo
                </label>
                {ehVoceMesmo && <input type="hidden" name="ativo" value="on" />}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" nativeButton={false} render={<Link href="/admin/usuarios" />}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {edicao ? "Salvar alterações" : "Criar usuário"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
