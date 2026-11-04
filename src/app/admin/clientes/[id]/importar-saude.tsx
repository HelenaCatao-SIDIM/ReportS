"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, CloudDownload, Loader2 } from "lucide-react";
import type { ResumoImportacao } from "@/lib/importacao-saude";
import { importarSaude, type RespostaImportacao } from "../importacao-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function Resumo({ r }: { r: ResumoImportacao }) {
  const e = r.estabelecimentos;
  const p = r.participantes;
  return (
    <div className="space-y-3 text-sm">
      <p className="flex items-center gap-2 font-medium text-emerald-800">
        <CheckCircle2 className="size-4" />
        {plural(r.funcionarios, "funcionário lido", "funcionários lidos")} do Saúde.
      </p>
      <div>
        <p className="font-medium">Estabelecimentos</p>
        <ul className="list-disc pl-5 text-muted-foreground">
          <li>{plural(e.criados, "novo", "novos")}</li>
          {e.ligados > 0 && <li>{plural(e.ligados, "já cadastrado com o mesmo nome e agora ligado ao Saúde", "já cadastrados com o mesmo nome e agora ligados ao Saúde")}</li>}
          {e.atualizados > 0 && <li>{plural(e.atualizados, "com endereço preenchido", "com endereço preenchido")}</li>}
          <li>{plural(e.semMudanca, "sem mudança", "sem mudança")}</li>
        </ul>
      </div>
      <div>
        <p className="font-medium">Profissionais (participantes)</p>
        {r.avisoParticipantes ? (
          <p className="flex gap-2 text-amber-800">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {r.avisoParticipantes}
          </p>
        ) : (
          <ul className="list-disc pl-5 text-muted-foreground">
            <li>{plural(p.criados, "novo", "novos")}</li>
            {p.atualizados > 0 && <li>{plural(p.atualizados, "com CPF ou CBO preenchido", "com CPF ou CBO preenchido")}</li>}
            <li>{plural(p.semMudanca, "sem mudança", "sem mudança")}</li>
            {p.semUsuario > 0 && <li>{plural(p.semUsuario, "funcionário sem usuário no Saúde ficou de fora", "funcionários sem usuário no Saúde ficaram de fora")}</li>}
            {p.usuarioInativo > 0 && <li>{plural(p.usuarioInativo, "com usuário inativo ficou de fora", "com usuário inativo ficaram de fora")}</li>}
          </ul>
        )}
      </div>
      {!r.avisoParticipantes && r.cpfEmUso.length > 0 && (
        <div className="rounded-md bg-amber-50 p-2 text-amber-900">
          <p className="font-medium">Entraram sem CPF, porque o CPF já é de outro participante:</p>
          <p className="text-xs">{r.cpfEmUso.join(" · ")}</p>
        </div>
      )}
      {!r.avisoParticipantes && r.parecidos.length > 0 && (
        <div className="rounded-md bg-amber-50 p-2 text-amber-900">
          <p className="font-medium">Nome parecido com um provisório (pode ser a mesma pessoa):</p>
          <p className="text-xs">{r.parecidos.join(" · ")}</p>
        </div>
      )}
    </div>
  );
}

/** Botão "Importar do Saúde" do cartão do sistema do cliente: confirma, importa e mostra o resumo. */
export function ImportarSaude({ clienteId, sistemaDoClienteId }: { clienteId: string; sistemaDoClienteId: string }) {
  const [aberto, setAberto] = useState(false);
  const [resposta, setResposta] = useState<RespostaImportacao | null>(null);
  const [pending, start] = useTransition();

  const importar = () =>
    start(async () => {
      setResposta(
        await importarSaude(clienteId, sistemaDoClienteId).catch((): RespostaImportacao => ({ status: "erro", mensagem: "Não foi possível falar com o servidor. Tente de novo." })),
      );
    });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => (setResposta(null), setAberto(true))}>
        <CloudDownload />
        Importar do Saúde
      </Button>
      <Dialog open={aberto} onOpenChange={(o) => !pending && setAberto(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importar do Saúde</DialogTitle>
            <DialogDescription>
              Traz do SIDIM Saúde os estabelecimentos e os profissionais (com usuário no Saúde) deste cliente. Pode repetir quando quiser: o que já
              foi importado não duplica, e nada do que foi editado no ReportS é apagado ou trocado.
            </DialogDescription>
          </DialogHeader>
          {resposta?.status === "ok" && <Resumo r={resposta.resumo} />}
          {resposta?.status === "erro" && (
            <p role="alert" className="flex gap-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {resposta.mensagem}
            </p>
          )}
          <DialogFooter>
            {resposta?.status === "ok" ? (
              <Button onClick={() => setAberto(false)}>Fechar</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setAberto(false)} disabled={pending}>
                  Cancelar
                </Button>
                <Button onClick={importar} disabled={pending}>
                  {pending ? <Loader2 className="animate-spin" /> : <CloudDownload />}
                  {pending ? "Importando…" : resposta ? "Tentar de novo" : "Importar"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
