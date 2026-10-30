import "server-only";

/*
 * Chaves de funcionalidades lidas no servidor (.env.local). As telas recebem o valor por props.
 * Com tudo desligado, o sistema se comporta como antes.
 */

const ligado = (nome: string) => process.env[nome] === "true";

/** Converte a coordenada do check-in/check-out em CEP e mostra o CEP no lugar da coordenada. */
export const localizacaoPorCep = () => ligado("LOCALIZACAO_POR_CEP");

/** Escreve data/hora e CEP no rodapé da foto do ambiente. Só vale com a localização por CEP ligada. */
export const carimboFoto = () => localizacaoPorCep() && ligado("CARIMBO_FOTO");

/** Botão "Buscar coordenadas pelo endereço" no cadastro do estabelecimento (consulta o Nominatim). */
export const buscaCoordenadas = () => ligado("BUSCA_COORDENADAS");

/**
 * Envio real de e-mail pelo SMTP da SIDIM (Oracle Cloud Email Delivery, o mesmo dos outros sistemas). Exige EMAIL_REAL=true e
 * SMTP_HOST (credenciais só no servidor). Sem isso, o e-mail é apenas gravado na Caixa de saída (simulado).
 */
export const emailReal = () => ligado("EMAIL_REAL") && !!process.env.SMTP_HOST?.trim();

export const smtp = () => {
  const porta = Number(process.env.SMTP_PORTA) || 587;
  return {
    host: process.env.SMTP_HOST!.trim(),
    porta,
    /** TLS desde o início da conexão (porta 465). Nas demais, a conexão é aberta e promovida a TLS (STARTTLS). */
    seguro: process.env.SMTP_SEGURO ? ligado("SMTP_SEGURO") : porta === 465,
    usuario: process.env.SMTP_USUARIO?.trim() || null,
    senha: process.env.SMTP_SENHA || null,
  };
};

/** Remetente. O SMTP só aceita remetentes aprovados (no OCI) ou o próprio endereço da conta: o padrão é o usuário. */
export const emailRemetente = () => {
  const definido = process.env.EMAIL_REMETENTE?.trim();
  if (definido) return definido;
  const usuario = process.env.SMTP_USUARIO?.trim();
  return usuario?.includes("@") ? `SIDIM Visitas <${usuario}>` : "SIDIM Visitas <nao-responda@localhost>";
};

/** Trava de teste: se definido, todo e-mail real vai para este endereço, com o destinatário original no assunto. */
export const emailRedirecionarPara = () => process.env.EMAIL_REDIRECIONAR_PARA?.trim() || null;

/** Identificação exigida pela política de uso do Nominatim (sistema + contato). */
export const geocodingUserAgent = () => process.env.GEOCODING_USER_AGENT || "SIDIM-Visitas/0.1 (configure GEOCODING_USER_AGENT)";

/** Endereço do SINC, onde os usuários, os papéis e as permissões são gerenciados (Admin do SINC). */
export const sincUrl = () => process.env.SINC_URL?.trim() || "https://sinc.sidim.com.br";
