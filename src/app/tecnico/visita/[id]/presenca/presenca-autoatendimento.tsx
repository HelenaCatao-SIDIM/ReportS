"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, CircleCheck, Loader2, Search, UserPlus, X } from "lucide-react";
import type { Cbo } from "@/lib/types";
import { formatarCpf, normalizar } from "@/lib/format";
import { entrarNoSaude, registrarPresenca, sugerirParticipantes, type PresencaState, type SugestaoParticipante } from "../../participantes-actions";
import { useAcao } from "@/components/form/use-acao";
import { CboCampo } from "@/components/form/cbo-campo";
import { AssinaturaCampo } from "@/components/tecnico/assinatura-campo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Config {
  visitaId: string;
  exigeAssinatura: boolean;
  exigeCpf: boolean;
  /** Setores do cliente, para sugerir no cadastro de quem não achou o próprio nome. */
  setores: string[];
  /** Setor da visita; já vem preenchido no cadastro de quem não achou o próprio nome. */
  setorVisita: string;
  /** O tenant do cliente liga o login do participante no Saúde: a presença só vale depois de a pessoa entrar. */
  exigeLogin: boolean;
  /** O técnico abriu a presença "sem login" (com o token que a tela da visita gera); as presenças ficam marcadas como tal. */
  modoTecnico: boolean;
  tokenTecnico: string | null;
}

const Erro = ({ msg }: { msg?: string }) => (msg ? <p className="mt-1 text-sm text-destructive">{msg}</p> : null);
const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? "";

/**
 * Uma pessoa por vez: busca o próprio nome, toca nele e assina. A tela não mostra os dados de ninguém (ocupação, setor, CPF,
 * quem já assinou), porque o aparelho passa de mão em mão. Quem não acha o nome pode se cadastrar ali mesmo.
 */
function Formulario({ visitaId, exigeAssinatura, exigeCpf, setores, setorVisita, exigeLogin, modoTecnico, tokenTecnico, onFeito }: Config & { onFeito: (nome: string) => void }) {
  const [state, onSubmit, pending] = useAcao<PresencaState>(registrarPresenca.bind(null, visitaId), {});
  const e = state.erros ?? {};
  const [modo, setModo] = useState<"busca" | "existente" | "novo">("busca");
  const [termo, setTermo] = useState("");
  const [sugestoes, setSugestoes] = useState<SugestaoParticipante[]>([]);
  const [jaNaLista, setJaNaLista] = useState<string[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [escolhido, setEscolhido] = useState<SugestaoParticipante | null>(null);
  const [nome, setNome] = useState("");
  const [cbo, setCbo] = useState<Cbo | null>(null);
  const [setor, setSetor] = useState(setorVisita);
  const [cpf, setCpf] = useState("");
  const [assinado, setAssinado] = useState(false);
  // Login no Saúde (só quando o tenant liga): usuário e senha ficam só aqui, nunca no formulário da presença.
  const precisaLogin = exigeLogin && !modoTecnico;
  const [prova, setProva] = useState<string | null>(null);
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [erroLogin, setErroLogin] = useState<string | null>(null);
  const [avisoTecnico, setAvisoTecnico] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seq = useRef(0);
  const quem = useRef("");

  useEffect(() => {
    if (state.ok) onFeito(quem.current);
  }, [state, onFeito]);

  function buscar(novo: string) {
    setTermo(novo);
    clearTimeout(timer.current);
    const n = ++seq.current;
    if (novo.trim().length < 2) {
      setSugestoes([]);
      setJaNaLista([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    timer.current = setTimeout(async () => {
      const r = await sugerirParticipantes(visitaId, novo);
      if (n !== seq.current) return;
      setSugestoes(r.sugestoes);
      setJaNaLista(r.jaNaLista);
      setBuscando(false);
    }, 250);
  }

  /** Escolher (ou trocar) a pessoa: o login e a prova de quem estava antes não valem para a nova. */
  function escolher(p: SugestaoParticipante | null) {
    setEscolhido(p);
    setProva(null);
    setUsuario("");
    setSenha("");
    setErroLogin(null);
    setAssinado(false);
  }

  async function entrar() {
    if (!escolhido) return;
    const u = usuario;
    const s = senha;
    setSenha(""); // a senha sai do estado já na chamada
    setErroLogin(null);
    setEntrando(true);
    try {
      const dados = new FormData();
      dados.set("usuario", u);
      dados.set("senha", s);
      const r = await entrarNoSaude(visitaId, escolhido.id, dados);
      if (r.ok) {
        setProva(r.prova);
        setUsuario("");
      } else setErroLogin(r.erro);
    } catch {
      setErroLogin("Não foi possível entrar agora. Tente de novo ou chame o técnico.");
    } finally {
      setEntrando(false);
    }
  }

  // Dois nomes iguais na lista: só então aparece a ocupação e o setor, para a pessoa saber qual é a dela.
  const repetidos = new Set(sugestoes.map((s) => normalizar(s.nome)).filter((n, i, todos) => todos.indexOf(n) !== i));
  // Com login exigido, CPF, assinatura e confirmação só aparecem depois de a pessoa entrar (quem não achou o nome fica com o técnico).
  const liberado = modo !== "busca" && (!precisaLogin || (modo === "existente" && !!prova));
  const podeConfirmar = liberado && (!exigeAssinatura || assinado);

  return (
    <form
      onSubmit={(ev) => {
        quem.current = modo === "existente" ? (escolhido?.nome ?? "") : nome;
        onSubmit(ev);
      }}
      noValidate
      className="space-y-4"
    >
      {e.geral && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{e.geral}</AlertDescription>
        </Alert>
      )}

      {prova && <input type="hidden" name="prova" value={prova} />}
      {modoTecnico && tokenTecnico && <input type="hidden" name="provaTecnico" value={tokenTecnico} />}

      {modo === "busca" && (
        <div className="space-y-3">
          <Label htmlFor="busca-participante" className="text-base">
            Digite seu nome
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="busca-participante"
              value={termo}
              onChange={(ev) => buscar(ev.target.value)}
              placeholder="Comece a digitar"
              autoComplete="off"
              autoCapitalize="words"
              autoFocus
              className="h-14 pl-10 text-lg"
            />
            {buscando && <Loader2 className="absolute top-1/2 right-3 size-5 -translate-y-1/2 animate-spin text-muted-foreground" />}
          </div>

          {termo.trim().length >= 2 && !buscando && (
            <div className="space-y-2">
              {sugestoes.length > 0 && (
                <ul className="divide-y rounded-xl border bg-background">
                  {sugestoes.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => {
                          escolher(s);
                          setCpf("");
                          setModo("existente");
                        }}
                        className="w-full px-4 py-3.5 text-left"
                      >
                        <span className="block text-base font-medium">{s.nome}</span>
                        {repetidos.has(normalizar(s.nome)) && (
                          <span className="block text-sm text-muted-foreground">{[s.cbo?.titulo, s.setor].filter(Boolean).join(" · ")}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {jaNaLista.map((n) => (
                <p key={n} className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <CircleCheck className="size-4 shrink-0" />
                  {n} já assinou. Não precisa assinar de novo.
                </p>
              ))}
              {sugestoes.length === 0 && jaNaLista.length === 0 && <p className="px-1 text-sm text-muted-foreground">Nenhum nome encontrado com “{termo.trim()}”.</p>}
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full text-base"
                onClick={() => {
                  // Com login exigido, quem não está na lista não tem como entrar: o técnico registra "sem login".
                  if (precisaLogin) {
                    setAvisoTecnico(true);
                    return;
                  }
                  setNome(termo.trim());
                  setCbo(null);
                  setSetor(setorVisita);
                  setCpf("");
                  setModo("novo");
                }}
              >
                <UserPlus />
                Não encontrei meu nome
              </Button>
              {avisoTecnico && precisaLogin && (
                <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="aviso-chame-tecnico">
                  Quem não está na lista não consegue entrar no Saúde por aqui. Chame o técnico para registrar a sua presença.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {modo === "existente" && escolhido && (
        <div className="space-y-4">
          <input type="hidden" name="participanteId" value={escolhido.id} />
          <div className="flex items-center justify-between gap-2 rounded-xl border bg-background px-4 py-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Presença de</div>
              <div className="truncate text-lg font-semibold">{escolhido.nome}</div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Não sou eu"
              onClick={() => {
                escolher(null);
                setModo("busca");
              }}
            >
              <X />
            </Button>
          </div>

          {precisaLogin && !prova &&
            (escolhido.ligadoAoSaude ? (
              <div className="space-y-3 rounded-xl border bg-background p-4" data-testid="login-saude">
                <div className="text-base font-medium">Entre com o seu usuário do Saúde</div>
                <Input
                  id="login-usuario"
                  aria-label="Usuário do Saúde"
                  placeholder="Usuário"
                  value={usuario}
                  onChange={(ev) => setUsuario(ev.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-12 text-lg"
                />
                <Input
                  id="login-senha"
                  aria-label="Senha do Saúde"
                  type="password"
                  placeholder="Senha"
                  value={senha}
                  onChange={(ev) => setSenha(ev.target.value)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") {
                      ev.preventDefault();
                      if (usuario.trim() && senha && !entrando) void entrar();
                    }
                  }}
                  autoComplete="new-password"
                  className="h-12 text-lg"
                />
                {erroLogin && (
                  <p className="text-sm text-destructive" role="alert">
                    {erroLogin}
                  </p>
                )}
                <Button type="button" disabled={entrando || !usuario.trim() || !senha} onClick={() => void entrar()} className="h-12 w-full text-base">
                  {entrando && <Loader2 className="animate-spin" />}
                  Entrar e continuar
                </Button>
                <p className="text-xs text-muted-foreground">A senha só é usada para entrar no Saúde: não fica guardada.</p>
              </div>
            ) : (
              <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="sem-id-saude">
                Seu cadastro ainda não está ligado ao Saúde, então não dá para entrar por aqui. Chame o técnico para registrar a sua presença.
              </p>
            ))}
          {precisaLogin && prova && (
            <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800" data-testid="login-ok">
              <CircleCheck className="size-4 shrink-0" />
              Login confirmado. Agora é só assinar.
            </p>
          )}

          {liberado && exigeCpf && !escolhido.cpfMascarado && (
            <div>
              <Label htmlFor="e-cpf" className="mb-1.5 text-base">
                Seu CPF
              </Label>
              <Input
                id="e-cpf"
                name="cpf"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(ev) => setCpf(formatarCpf(ev.target.value))}
                className="h-12 text-lg"
                aria-invalid={!!e.cpf}
              />
              <Erro msg={e.cpf} />
              {state.existente && state.existente.id !== escolhido.id && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
                  <div className="min-w-0 text-sm font-medium">{state.existente.nome}</div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      if (!state.existente) return;
                      escolher(state.existente);
                      setCpf("");
                    }}
                  >
                    É esta pessoa
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {modo === "novo" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold">Seus dados</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setModo("busca")}>
              Voltar à busca
            </Button>
          </div>
          <div>
            <Label htmlFor="n-nome" className="mb-1.5 text-base">
              Nome completo
            </Label>
            <Input id="n-nome" name="nome" value={nome} onChange={(ev) => setNome(ev.target.value)} className="h-12 text-lg" aria-invalid={!!e.nome} />
            <Erro msg={e.nome} />
          </div>
          {state.semelhantes && state.semelhantes.length > 0 && (
            <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-900">Seu nome já está na lista? Toque nele:</p>
              <ul className="divide-y divide-amber-200">
                {state.semelhantes.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0 text-sm font-medium">{s.nome}</div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        escolher(s);
                        setModo("existente");
                      }}
                    >
                      Sou eu
                    </Button>
                  </li>
                ))}
              </ul>
              <label className="flex items-center gap-2 text-sm text-amber-900">
                <input type="checkbox" name="homonimo" className="size-4 accent-primary" />
                Não sou nenhuma destas pessoas
              </label>
            </div>
          )}
          <div>
            <Label htmlFor="n-cbo" className="mb-1.5 text-base">
              Ocupação
            </Label>
            <CboCampo id="n-cbo" name="cbo" inicial={cbo} onMudar={setCbo} invalido={!!e.cbo} />
            <Erro msg={e.cbo} />
          </div>
          <div>
            <Label htmlFor="n-setor" className="mb-1.5 text-base">
              Setor (opcional)
            </Label>
            <Input id="n-setor" name="setor" list="setores-cliente" value={setor} onChange={(ev) => setSetor(ev.target.value)} className="h-12 text-lg" />
            <datalist id="setores-cliente">
              {setores.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          {exigeCpf && (
            <div>
              <Label htmlFor="n-cpf" className="mb-1.5 text-base">
                CPF
              </Label>
              <Input
                id="n-cpf"
                name="cpf"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(ev) => setCpf(formatarCpf(ev.target.value))}
                className="h-12 text-lg"
                aria-invalid={!!e.cpf}
              />
              <Erro msg={e.cpf} />
              {state.existente && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
                  <div className="min-w-0 text-sm font-medium">{state.existente.nome}</div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      if (!state.existente) return;
                      escolher(state.existente);
                      setModo("existente");
                    }}
                  >
                    É esta pessoa
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {liberado && exigeAssinatura && (
        <div>
          <div className="mb-1.5 text-base font-medium">Assine abaixo</div>
          <AssinaturaCampo name="assinatura" invalido={!!e.assinatura} onMudar={setAssinado} />
          <Erro msg={e.assinatura} />
        </div>
      )}

      {liberado && (
        <div className="space-y-2">
          <Button type="submit" disabled={!podeConfirmar || pending} className="h-14 w-full text-lg">
            {pending && <Loader2 className="animate-spin" />}
            Confirmar presença
          </Button>
          <p className="text-center text-xs text-muted-foreground">Ao confirmar, você declara que participou deste atendimento.</p>
        </div>
      )}
    </form>
  );
}

/** Tela de agradecimento: volta sozinha para a busca, para o aparelho passar para a próxima pessoa. */
function Obrigado({ nome, onProxima }: { nome: string; onProxima: () => void }) {
  useEffect(() => {
    const t = setTimeout(onProxima, 4000);
    return () => clearTimeout(t);
  }, [onProxima]);
  return (
    <div className="space-y-5 py-8 text-center" role="status">
      <CircleCheck className="mx-auto size-16 text-emerald-600" />
      <div>
        <div className="text-xl font-semibold">Presença confirmada</div>
        <p className="mt-1 text-base text-muted-foreground">Obrigado, {primeiroNome(nome)}!</p>
      </div>
      <Button type="button" variant="outline" className="h-12 px-6 text-base" onClick={onProxima}>
        Próxima pessoa
      </Button>
    </div>
  );
}

/** Área do técnico, no pé da tela: fecha a presença e segue para os temas e anotações. Pede uma confirmação, para ninguém tocar sem querer. */
function AreaDoTecnico({ presentes, exigeParticipantes, proximaRota }: { presentes: number; exigeParticipantes: boolean; proximaRota: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const semNinguem = presentes === 0;
  return (
    <div className="space-y-2 border-t pt-4 text-center">
      <p className="text-xs text-muted-foreground" data-testid="contagem-presencas">
        {presentes} {presentes === 1 ? "presença confirmada" : "presenças confirmadas"}
      </p>
      {!confirmando ? (
        <Button type="button" variant="ghost" size="sm" disabled={semNinguem && exigeParticipantes} onClick={() => setConfirmando(true)}>
          {semNinguem ? (exigeParticipantes ? "Aguardando a primeira presença" : "Continuar sem participantes") : "Todos assinaram? Continuar"}
        </Button>
      ) : (
        <div className="space-y-2 rounded-xl border bg-background p-3">
          <p className="text-sm">Só o técnico deve continuar. A lista de presença fecha e o aparelho segue para os temas e anotações.</p>
          <div className="flex justify-center gap-2">
            <Button nativeButton={false} render={<Link href={proximaRota} />} size="sm">
              Continuar
              <ArrowRight />
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmando(false)}>
              Voltar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PresencaAutoatendimento({
  presentes,
  exigeParticipantes,
  proximaRota,
  ...config
}: Config & { presentes: number; exigeParticipantes: boolean; proximaRota: string }) {
  const [rodada, setRodada] = useState(0);
  const [feito, setFeito] = useState<string | null>(null);
  const proxima = useCallback(() => {
    setFeito(null);
    setRodada((r) => r + 1);
  }, []);

  return (
    <div className="space-y-6">
      {config.modoTecnico && (
        <div className="space-y-1 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" data-testid="modo-tecnico">
          <p>Modo do técnico: as presenças registradas aqui ficam marcadas como <b>sem login</b>. Use só para quem não consegue entrar no Saúde.</p>
          <Link href={`/tecnico/visita/${config.visitaId}/presenca`} className="font-medium underline">
            Voltar ao modo com login
          </Link>
        </div>
      )}
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Confirme sua presença</h1>
        {!feito && (
          <p className="mt-1 text-sm text-muted-foreground">
            {config.exigeLogin && !config.modoTecnico
              ? config.exigeAssinatura
                ? "Busque seu nome, entre com seu usuário do Saúde e assine."
                : "Busque seu nome, entre com seu usuário do Saúde e confirme."
              : config.exigeAssinatura
                ? "Busque seu nome e assine."
                : "Busque seu nome e confirme."}
          </p>
        )}
      </div>
      {feito !== null ? <Obrigado nome={feito} onProxima={proxima} /> : <Formulario key={rodada} {...config} onFeito={setFeito} />}
      <AreaDoTecnico presentes={presentes} exigeParticipantes={exigeParticipantes} proximaRota={proximaRota} />
    </div>
  );
}
