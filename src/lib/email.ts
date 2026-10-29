import "server-only";
import nodemailer from "nodemailer";
import { emailRedirecionarPara, emailReal, emailRemetente, provedorEmail, smtp } from "@/lib/config";
import { lerArquivo } from "@/lib/repo/arquivos";

/*
 * Envio de e-mail. Com EMAIL_REAL=true e as credenciais do provedor (Resend, por padrão, ou SMTP), envia de verdade;
 * sem isso, só grava na caixa de saída (visível em /admin/emails), como antes. Quem chama `enviarEmail` não muda, e a função nunca lança exceção:
 * uma falha de envio vira situação "falhou" na caixa de saída, para não desfazer uma emissão já registrada.
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
  /** Identificador da mensagem no provedor, quando enviada de verdade. */
  idMensagem: string | null;
  /** Motivo da falha, quando a situação é "falhou". */
  erro: string | null;
  /** Endereço que realmente recebeu, quando a trava de teste (EMAIL_REDIRECIONAR_PARA) estava ligada. */
  redirecionadoPara: string | null;
}

export type NovoEmail = Pick<EmailEnviado, "para" | "assunto" | "html" | "anexos" | "botao" | "relatorioId">;

const g = globalThis as unknown as { __emails?: EmailEnviado[] };
const caixa = (g.__emails ??= []);

const ESPERA_NOVA_TENTATIVA_MS = 1500;
const RESEND = "https://api.resend.com/emails";
const TIMEOUT_RESEND_MS = 15_000;

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

async function anexosDoEmail(anexos: Anexo[]) {
  const lista: { filename: string; content: Buffer; contentType: string }[] = [];
  for (const a of anexos) {
    const arquivo = a.url.startsWith("/arquivos/") ? await lerArquivo(a.url.slice("/arquivos/".length)) : null;
    if (!arquivo) throw new ErroDefinitivo(`Anexo não encontrado: ${a.nome}`);
    lista.push({ filename: a.nome, content: arquivo.dados, contentType: arquivo.tipo });
  }
  return lista;
}

class ErroDefinitivo extends Error {}

/** Mensagem curta e sem dados sensíveis (nunca inclui usuário nem senha). */
function motivo(erro: unknown): { texto: string; definitivo: boolean } {
  if (erro instanceof ErroDefinitivo) return { texto: erro.message, definitivo: true };
  const e = erro as { code?: string; responseCode?: number; response?: string; message?: string };
  if (e.code === "EAUTH") return { texto: "O servidor SMTP recusou o usuário ou a senha. No Gmail, use uma senha de app.", definitivo: true };
  // Resposta do servidor: 5xx é definitiva (endereço recusado, política); 4xx é temporária e vale uma nova tentativa.
  if (e.responseCode && e.responseCode >= 500) return { texto: `O servidor SMTP recusou a mensagem (${e.responseCode}): ${(e.response ?? "").slice(0, 160)}`, definitivo: true };
  if (e.responseCode) return { texto: `O servidor SMTP respondeu ${e.responseCode}: ${(e.response ?? "").slice(0, 160)}`, definitivo: false };
  if (e.code === "EENVELOPE" || e.code === "EMESSAGE") return { texto: "O servidor SMTP recusou a mensagem.", definitivo: true };
  return { texto: `Não foi possível falar com o ${provedorEmail() === "smtp" ? "servidor SMTP" : "Resend"} (conexão, porta ou tempo esgotado).`, definitivo: false };
}

/** Envia pelo Resend. Tenta uma segunda vez em erro de rede, limite (429) ou erro do servidor (5xx). Devolve o id do e-mail no Resend. */
async function enviarPeloResend(e: NovoEmail, idEnvio: string, destino: string | null): Promise<string> {
  const corpo = {
    from: emailRemetente(),
    to: [destino ?? e.para.email],
    subject: destino ? `[TESTE → ${e.para.nome} <${e.para.email}>] ${e.assunto}` : e.assunto,
    html: htmlCompleto(e),
    text: textoSimples(e),
    attachments: (await anexosDoEmail(e.anexos)).map((a) => ({ filename: a.filename, content: a.content.toString("base64") })),
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
        signal: AbortSignal.timeout(TIMEOUT_RESEND_MS),
        cache: "no-store",
      });
      const json = (await r.json().catch(() => null)) as { id?: unknown; message?: unknown } | null;
      if (r.ok && json?.id) return String(json.id);
      if ((r.status === 429 || r.status >= 500) && tentativa === 1) {
        await espera(ESPERA_NOVA_TENTATIVA_MS);
        continue;
      }
      throw new ErroDefinitivo(`O Resend respondeu ${r.status}${typeof json?.message === "string" ? `: ${json.message}` : ""}`);
    } catch (erro) {
      if (erro instanceof ErroDefinitivo || tentativa === 2) throw erro;
      await espera(ESPERA_NOVA_TENTATIVA_MS);
    }
  }
  throw new Error("Falha ao enviar o e-mail");
}

/** Envia por SMTP. Tenta uma segunda vez em erro de conexão ou resposta temporária (4xx). Devolve o id da mensagem. */
async function enviarPorSmtp(e: NovoEmail, destino: string | null): Promise<string> {
  const c = smtp();
  const local = c.host === "localhost" || c.host === "127.0.0.1";
  const transporte = nodemailer.createTransport({
    host: c.host,
    port: c.porta,
    secure: c.seguro,
    // Fora do computador local, não manda usuário e senha sem criptografia.
    requireTLS: !c.seguro && !local,
    auth: c.usuario && c.senha ? { user: c.usuario, pass: c.senha } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
  const mensagem = {
    from: emailRemetente(),
    to: destino ?? e.para.email,
    subject: destino ? `[TESTE → ${e.para.nome} <${e.para.email}>] ${e.assunto}` : e.assunto,
    html: htmlCompleto(e),
    text: textoSimples(e),
    attachments: await anexosDoEmail(e.anexos),
  };

  try {
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      try {
        const info = await transporte.sendMail(mensagem);
        if (info.rejected?.length) throw new ErroDefinitivo("O servidor SMTP recusou o destinatário.");
        return String(info.messageId ?? "");
      } catch (erro) {
        if (motivo(erro).definitivo || tentativa === 2) throw erro;
        await espera(ESPERA_NOVA_TENTATIVA_MS);
      }
    }
    throw new Error("Falha ao enviar o e-mail");
  } finally {
    transporte.close();
  }
}

export async function enviarEmail(e: NovoEmail): Promise<EmailEnviado> {
  const id = crypto.randomUUID();
  const email: EmailEnviado = { ...e, id, enviadoEm: new Date().toISOString(), situacao: "simulado", idMensagem: null, erro: null, redirecionadoPara: null };

  if (emailReal()) {
    email.redirecionadoPara = emailRedirecionarPara();
    try {
      email.idMensagem =
        provedorEmail() === "smtp" ? await enviarPorSmtp(e, email.redirecionadoPara) : await enviarPeloResend(e, id, email.redirecionadoPara);
      email.situacao = "enviado";
    } catch (erro) {
      email.situacao = "falhou";
      email.erro = motivo(erro).texto;
      // Sem endereço no log (dado pessoal), sem usuário e sem senha.
      console.error(`[email] envio ${id} falhou: ${email.erro}`);
    }
  }

  caixa.push(email);
  return email;
}

export async function listarEmails(): Promise<EmailEnviado[]> {
  return [...caixa].reverse();
}
