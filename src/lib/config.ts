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
 * Envio real de e-mail por SMTP (Gmail, Microsoft 365, e-mail da própria SIDIM...): exige EMAIL_REAL=true e SMTP_HOST.
 * Usuário e senha ficam só no servidor. Sem isso, o e-mail é apenas gravado na Caixa de saída (simulado).
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

/** Remetente. Gmail e Microsoft 365 só aceitam o próprio endereço da conta; se não houver EMAIL_REMETENTE, usa o usuário do SMTP. */
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
