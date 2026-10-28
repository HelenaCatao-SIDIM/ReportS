import "server-only";
import { emailRedirecionarPara, emailReal, emailRemetente } from "@/lib/config";
import { lerArquivo } from "@/lib/repo/arquivos";

/*
 * Envio de e-mail. Com EMAIL_REAL=true e RESEND_API_KEY, envia de verdade pelo Resend; sem isso, só grava na
 * caixa de saída (visível em /admin/emails), como antes. Quem chama `enviarEmail` não muda, e a função nunca lança
 * exceção: uma falha de envio vira situação "falhou" na caixa de saída, para não desfazer uma emissão já registrada.
 */

export interface Anexo {
  nome: string;
  url: string;
  tamanho: number;
}

export type SituacaoEmail = "simulado" | "enviado" | "falhou";

export interface EmailEnviado {
  id: string;
  para: { nome: string; email: string };
  assunto: string;
  /** Corpo em HTML simples. */
  html: string;
  anexos: Anexo[];
  /** Botão principal do e-mail (ex.: "Ver relatório"). */
  botao: { texto: string; url: string } | null;
  enviadoEm: string;
  relatorioId: string | null;
  situacao: SituacaoEmail;
  /** Identificador do e-mail no provedor, quando enviado de verdade. */
  idProvedor: string | null;
  /** Motivo da falha, quando a situação é "falhou". */
  erro: string | null;
  /** Endereço que realmente recebeu, quando a trava de teste (EMAIL_REDIRECIONAR_PARA) estava ligada. */
  redirecionadoPara: string | null;
}

export type NovoEmail = Pick<EmailEnviado, "para" | "assunto" | "html" | "anexos" | "botao" | "relatorioId">;

const g = globalThis as unknown as { __emails?: EmailEnviado[] };
const caixa = (g.__emails ??= []);

const RESEND = "https://api.resend.com/emails";
const TIMEOUT_MS = 15_000;
const ESPERA_NOVA_TENTATIVA_MS = 1200;

const esc = (t: string) => t.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Corpo + botão num HTML de e-mail (estilos em linha, que é o que os leitores de e-mail aceitam). */
function htmlCompleto(e: NovoEmail): string {
  const botao = e.botao
    ? `<p style="margin:24px 0"><a href="${esc(e.botao.url)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">${esc(e.botao.texto)}</a></p>` +
      `<p style="font-size:12px;color:#64748b">Se o botão não abrir, copie este endereço no navegador:<br>${esc(e.botao.url)}</p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1e293b"><div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;line-height:1.6;font-size:15px">${e.html}${botao}</div></body></html>`;
}

/** Versão só texto (melhora a entrega e serve a quem não lê HTML). */
function textoSimples(e: NovoEmail): string {
  const corpo = e.html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
  return e.botao ? `${corpo}\n\n${e.botao.texto}: ${e.botao.url}` : corpo;
}

async function anexosEmBase64(anexos: Anexo[]) {
  const lista: { filename: string; content: string }[] = [];
  for (const a of anexos) {
    const arquivo = a.url.startsWith("/arquivos/") ? await lerArquivo(a.url.slice("/arquivos/".length)) : null;
    if (!arquivo) throw new Error(`Anexo não encontrado: ${a.nome}`);
    lista.push({ filename: a.nome, content: arquivo.dados.toString("base64") });
  }
  return lista;
}

class ErroDefinitivo extends Error {}

/** Envia pelo Resend. Tenta uma segunda vez em erro de rede, limite (429) ou erro do servidor (5xx). Devolve o id do provedor. */
async function enviarPeloResend(e: NovoEmail, idEnvio: string, destino: string | null): Promise<string> {
  const corpo = {
    from: emailRemetente(),
    to: [destino ?? e.para.email],
    subject: destino ? `[TESTE → ${e.para.nome} <${e.para.email}>] ${e.assunto}` : e.assunto,
    html: htmlCompleto(e),
    text: textoSimples(e),
    attachments: await anexosEmBase64(e.anexos),
  };

  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      const r = await fetch(RESEND, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          // Evita e-mail duplicado se a primeira tentativa chegou ao Resend mas a resposta se perdeu.
          "Idempotency-Key": idEnvio,
        },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      const json = (await r.json().catch(() => null)) as { id?: unknown; message?: unknown } | null;
      if (r.ok && json?.id) return String(json.id);
      if ((r.status === 429 || r.status >= 500) && tentativa === 1) {
        await espera(ESPERA_NOVA_TENTATIVA_MS);
        continue;
      }
      throw new ErroDefinitivo(`Resend respondeu ${r.status}${typeof json?.message === "string" ? `: ${json.message}` : ""}`);
    } catch (erro) {
      if (erro instanceof ErroDefinitivo || tentativa === 2) throw erro;
      await espera(ESPERA_NOVA_TENTATIVA_MS);
    }
  }
  throw new Error("Falha ao enviar o e-mail");
}

export async function enviarEmail(e: NovoEmail): Promise<EmailEnviado> {
  const id = crypto.randomUUID();
  const email: EmailEnviado = { ...e, id, enviadoEm: new Date().toISOString(), situacao: "simulado", idProvedor: null, erro: null, redirecionadoPara: null };

  if (emailReal()) {
    email.redirecionadoPara = emailRedirecionarPara();
    try {
      email.idProvedor = await enviarPeloResend(e, id, email.redirecionadoPara);
      email.situacao = "enviado";
    } catch (erro) {
      email.situacao = "falhou";
      email.erro = erro instanceof Error ? erro.message : "Falha ao enviar o e-mail";
      // Sem endereço no log (dado pessoal) e sem a chave.
      console.error(`[email] envio ${id} falhou: ${email.erro}`);
    }
  }

  caixa.push(email);
  return email;
}

export async function listarEmails(): Promise<EmailEnviado[]> {
  return [...caixa].reverse();
}
