import { PageHeader } from "@/components/shell/placeholder";
import { ClienteForm } from "../cliente-form";
import { criarCliente } from "../actions";
import { chamadosSuporte } from "@/lib/config-suporte";

export default function NovoClientePage() {
  return (
    <div className="max-w-3xl">
      <PageHeader titulo="Novo cliente" descricao="Depois de criar, você cadastra os estabelecimentos e os setores do cliente." />
      <ClienteForm acao={criarCliente} chamadosAtivos={chamadosSuporte()} />
    </div>
  );
}
