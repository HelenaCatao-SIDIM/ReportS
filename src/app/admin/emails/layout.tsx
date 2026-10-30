import { GuardaTela } from "@/components/shell/area-protegida";

export default function Layout({ children }: LayoutProps<"/admin/emails">) {
  return <GuardaTela tela="/admin/emails">{children}</GuardaTela>;
}
