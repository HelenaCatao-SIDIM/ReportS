import { GuardaTela } from "@/components/shell/area-protegida";

export default function Layout({ children }: LayoutProps<"/admin/participantes">) {
  return <GuardaTela tela="/admin/participantes">{children}</GuardaTela>;
}
