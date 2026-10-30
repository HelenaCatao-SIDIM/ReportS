import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { sincUrl } from "@/lib/config";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar · SIDIM Visitas" };

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ClipboardCheck className="size-6" />
          </div>
          <h1 className="text-xl font-semibold">SIDIM Visitas</h1>
          <p className="text-sm text-muted-foreground">Registro de visitas e treinamentos</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>Use seu e-mail e senha da SIDIM.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <LoginForm />
            {/* A senha é a mesma do SINC e é trocada lá (o cadastro de usuários é um só). */}
            <p className="text-center text-sm">
              <a href={`${sincUrl()}/passwords/new`} className="text-muted-foreground underline-offset-4 hover:underline">
                Esqueci minha senha
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
