"use client";

import Link from "next/link";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { AlertCircle, Loader2, Plus, X } from "lucide-react";
import type { ClienteCheckin } from "@/lib/repo/contratos";
import type { TipoVisita } from "@/lib/types";
import { comprimirImagem } from "@/lib/imagem";
import { ehPresencial, TIPOS_VISITA } from "@/lib/visitas";
import { exigeParticipantes, sugereTemasPorEquipe } from "@/lib/regras-visita";
import { buscarParticipantesRetroativa, lancarRetroativa, type ParticipanteOpcao, type RetroativaState } from "./actions";
import { Campo, selectClass } from "@/components/form/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Hoje no horário de Brasília (limite do campo de data). */
const hojeBrasilia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

function Erro({ msg }: { msg?: string }) {
  return msg ? <p className="text-xs text-destructive">{msg}</p> : null;
}

export function RetroativaForm({
  clientes,
  tecnicos,
  equipes,
  temas,
}: {
  clientes: ClienteCheckin[];
  tecnicos: { id: string; nome: string }[];
  equipes: { id: string; nome: string }[];
  temas: { id: string; nome: string; sistema: string; modulo: string }[];
}) {
  const [state, setState] = useState<RetroativaState>({});
  const [pending, start] = useTransition();
  const e = state.erros ?? {};

  const [clienteId, setClienteId] = useState("");
  const [contratoId, setContratoId] = useState("");
  const [tipo, setTipo] = useState<TipoVisita | "">("");
  const [participantes, setParticipantes] = useState<ParticipanteOpcao[]>([]);
  const [busca, setBusca] = useState("");
  const [sugestoes, setSugestoes] = useState<ParticipanteOpcao[]>([]);
  const [fotos, setFotos] = useState<File[]>([]);
  const [lista, setLista] = useState<File[]>([]);
  const [preparandoFotos, setPreparandoFotos] = useState(false);

  const cliente = clientes.find((c) => c.id === clienteId);
  const contrato = cliente?.contratos.find((k) => k.id === contratoId);
  const temasDoSistema = contrato ? temas.filter((t) => t.sistema === contrato.sistema) : [];
  const registraEquipes = tipo !== "" && sugereTemasPorEquipe(tipo);

  // Busca de participantes do sistema do cliente (a partir de 2 letras).
  useEffect(() => {
    if (!contratoId || busca.trim().length < 2) return;
    let ativo = true;
    const t = setTimeout(async () => {
      const r = await buscarParticipantesRetroativa(contratoId, busca);
      if (ativo) setSugestoes(r);
    }, 250);
    return () => {
      ativo = false;
      clearTimeout(t);
    };
  }, [contratoId, busca]);
  const sugestoesVisiveis = busca.trim().length >= 2 ? sugestoes.filter((s) => !participantes.some((p) => p.id === s.id)) : [];

  async function escolherFotos(escolhidas: FileList | null, guardar: (novas: File[]) => void) {
    if (!escolhidas?.length) return;
    setPreparandoFotos(true);
    const novas: File[] = [];
    for (const f of Array.from(escolhidas)) {
      try {
        novas.push(await comprimirImagem(f));
      } catch {
        // Imagem que o navegador não consegue ler: fica de fora.
      }
    }
    guardar(novas);
    setPreparandoFotos(false);
  }

  function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    fd.delete("fotos");
    for (const f of fotos) fd.append("fotos", f);
    for (const f of lista) fd.append("listaPresenca", f);
    start(async () => setState(await lancarRetroativa(state, fd)));
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      {Object.keys(e).length > 0 && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{e.geral ?? "Revise os campos destacados."}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Dados da visita</CardTitle>
          <CardDescription>Horários no horário de Brasília.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Campo id="cliente" label="Cliente" erro={e.contrato}>
            <select
              id="cliente"
              value={clienteId}
              onChange={(ev) => {
                const c = clientes.find((x) => x.id === ev.target.value);
                setClienteId(ev.target.value);
                setContratoId(c?.contratos.length === 1 ? c.contratos[0].id : "");
                setParticipantes([]);
                setSugestoes([]);
              }}
              className={selectClass}
            >
              <option value="">Escolha o cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="contratoId" label="Sistema">
            <select
              id="contratoId"
              name="contratoId"
              value={contratoId}
              disabled={!cliente}
              onChange={(ev) => {
                setContratoId(ev.target.value);
                setParticipantes([]);
                setSugestoes([]);
              }}
              className={selectClass}
            >
              <option value="">{cliente ? "Escolha o sistema" : "Escolha o cliente primeiro"}</option>
              {cliente?.contratos.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.sistemaNome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="unidadeId" label="Estabelecimento" erro={e.unidade}>
            <select id="unidadeId" name="unidadeId" defaultValue="" key={clienteId} disabled={!cliente} className={selectClass}>
              <option value="">{cliente ? "Escolha o estabelecimento" : "Escolha o cliente primeiro"}</option>
              {cliente?.unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="tecnicoId" label="Técnico que fez a visita" erro={e.tecnico}>
            <select id="tecnicoId" name="tecnicoId" defaultValue="" className={selectClass}>
              <option value="">Escolha o técnico</option>
              {tecnicos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="tipo" label="Tipo de visita" erro={e.tipo}>
            <select id="tipo" name="tipo" value={tipo} onChange={(ev) => setTipo(ev.target.value as TipoVisita)} className={selectClass}>
              <option value="">Escolha o tipo</option>
              {TIPOS_VISITA.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="data" label="Data" erro={e.data}>
            <Input id="data" name="data" type="date" max={hojeBrasilia()} className="h-9" />
          </Campo>
          <div className="grid grid-cols-2 gap-4">
            <Campo id="horaEntrada" label="Entrada" erro={e.entrada}>
              <Input id="horaEntrada" name="horaEntrada" type="time" className="h-9" />
            </Campo>
            <Campo id="horaSaida" label="Saída" erro={e.saida}>
              <Input id="horaSaida" name="horaSaida" type="time" className="h-9" />
            </Campo>
          </div>
          {tipo !== "" && !ehPresencial(tipo) && (
            <Campo id="linkReuniao" label="Link da reunião (opcional)">
              <Input id="linkReuniao" name="linkReuniao" placeholder="https://" className="h-9" />
            </Campo>
          )}
        </CardContent>
      </Card>

      {registraEquipes && (
        <Card>
          <CardHeader>
            <CardTitle>Equipes treinadas</CardTitle>
            <CardDescription>Contam para o cronograma, como numa visita normal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {equipes.length ? (
              <div className="grid gap-1.5 sm:grid-cols-3">
                {equipes.map((eq) => (
                  <label key={eq.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="equipeIds" value={eq.id} className="size-4 accent-primary" />
                    {eq.nome}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma equipe cadastrada.</p>
            )}
            <Erro msg={e.equipes} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Temas</CardTitle>
          <CardDescription>{contrato ? `Temas do sistema ${contrato.sistemaNome}.` : "Escolha o cliente e o sistema para ver os temas."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {temasDoSistema.length > 0 && (
            <div className="grid max-h-72 gap-1.5 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2" key={contratoId}>
              {temasDoSistema.map((t) => (
                <label key={t.id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="temaIds" value={t.id} className="mt-0.5 size-4 accent-primary" />
                  <span>
                    {t.nome}
                    <span className="block text-xs text-muted-foreground">{t.modulo}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <Campo id="temaAdicional" label="Tema adicional (se não estiver na lista)">
            <Input id="temaAdicional" name="temaAdicional" className="h-9" />
          </Campo>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Participantes</CardTitle>
          <CardDescription>
            Marque quem participou, do cadastro do cliente, ou anexe a foto da lista de presença em papel (ou os dois). Sem assinatura: os
            nomes marcados ficam como confirmação nominal.
            {tipo !== "" && exigeParticipantes(tipo) && " Treinamento precisa de um dos dois."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {participantes.length > 0 && (
            <ul className="divide-y rounded-lg border">
              {participantes.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <input type="hidden" name="participanteIds" value={p.id} />
                  <span className="min-w-0 truncate">
                    {p.nome}
                    <span className="ml-2 text-xs text-muted-foreground">{[p.ocupacao, p.setor].filter(Boolean).join(" · ")}</span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Retirar ${p.nome}`}
                    onClick={() => setParticipantes((atuais) => atuais.filter((x) => x.id !== p.id))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Input
            value={busca}
            onChange={(ev) => setBusca(ev.target.value)}
            disabled={!contratoId}
            placeholder={contratoId ? "Buscar participante pelo nome" : "Escolha o cliente e o sistema primeiro"}
            aria-label="Buscar participante"
            className="h-9"
          />
          {sugestoesVisiveis.length > 0 && (
            <ul className="divide-y rounded-lg border">
              {sugestoesVisiveis.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setParticipantes((atuais) => [...atuais, s]);
                      setBusca("");
                      setSugestoes([]);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
                  >
                    <Plus className="size-4 shrink-0 text-primary" />
                    <span className="min-w-0 truncate">
                      {s.nome}
                      <span className="ml-2 text-xs text-muted-foreground">{[s.ocupacao, s.setor, s.cpfMascarado].filter(Boolean).join(" · ")}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-2 rounded-lg border border-dashed p-3">
            <div className="text-sm font-medium">Foto da lista de presença</div>
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={(ev) => void escolherFotos(ev.target.files, (novas) => setLista((atuais) => [...atuais, ...novas]))}
              className="h-9"
              aria-label="Anexar foto da lista de presença"
            />
            {lista.length > 0 && (
              <ul className="space-y-1 text-sm">
                {lista.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2">
                    <span className="truncate">{f.name}</span>
                    <button type="button" aria-label={`Retirar ${f.name}`} onClick={() => setLista((atuais) => atuais.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Erro msg={e.lista} />
          </div>
          <Erro msg={e.participantes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Anotações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Campo id="observacoes" label="Observações">
            <Textarea id="observacoes" name="observacoes" rows={3} />
          </Campo>
          <Campo id="pendencias" label="Pendências">
            <Textarea id="pendencias" name="pendencias" rows={2} />
          </Campo>
          <Campo id="proximosPassos" label="Próximos passos">
            <Textarea id="proximosPassos" name="proximosPassos" rows={2} />
          </Campo>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fotos (opcional)</CardTitle>
          <CardDescription>Por exemplo, fotos tiradas no dia. Até 10 imagens, somando com a lista de presença.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input type="file" accept="image/*" multiple onChange={(ev) => void escolherFotos(ev.target.files, (novas) => setFotos((atuais) => [...atuais, ...novas]))} className="h-9" aria-label="Escolher fotos" />
          {preparandoFotos && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Preparando as fotos…
            </p>
          )}
          {fotos.length > 0 && (
            <ul className="space-y-1 text-sm">
              {fotos.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2">
                  <span className="truncate">{f.name}</span>
                  <button type="button" aria-label={`Retirar ${f.name}`} onClick={() => setFotos((atuais) => atuais.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Erro msg={e.fotos} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Motivo do lançamento</CardTitle>
          <CardDescription>Fica no histórico da visita, com o seu nome.</CardDescription>
        </CardHeader>
        <CardContent>
          <Campo id="motivo" label="Por que a visita está sendo lançada depois?" erro={e.motivo}>
            <Textarea id="motivo" name="motivo" rows={2} placeholder="Ex.: visita feita antes de o cliente estar no ReportS" />
          </Campo>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href="/admin/visitas?aba=encerradas" />}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending || preparandoFotos}>
          {pending && <Loader2 className="animate-spin" />}
          Lançar visita
        </Button>
      </div>
    </form>
  );
}
