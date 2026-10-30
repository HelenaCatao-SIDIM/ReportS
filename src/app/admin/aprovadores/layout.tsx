import { GuardaTela } from "@/components/shell/area-protegida";

export default function Layout({ children }: LayoutProps<"/admin/aprovadores">) {
  return <GuardaTela tela="/admin/aprovadores">{children}</GuardaTela>;
}
