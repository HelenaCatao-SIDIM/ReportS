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
 * Envio real de e-mail pelo Resend: exige EMAIL_REAL=true e RESEND_API_KEY (a chave fica só no servidor).
 * Sem isso, o e-mail é apenas gravado na Caixa de saída (simulado).
 */
export const emailReal = () => ligado("EMAIL_REAL") && !!process.env.RESEND_API_KEY?.trim();

/** Remetente. O padrão é o de testes do Resend, que só entrega ao dono da conta; para clientes, use um domínio verificado. */
export const emailRemetente = () => process.env.EMAIL_REMETENTE?.trim() || "SIDIM Visitas <onboarding@resend.dev>";

/** Trava de teste: se definido, todo e-mail real vai para este endereço, com o destinatário original no assunto. */
export const emailRedirecionarPara = () => process.env.EMAIL_REDIRECIONAR_PARA?.trim() || null;

/** Identificação exigida pela política de uso do Nominatim (sistema + contato). */
export const geocodingUserAgent = () => process.env.GEOCODING_USER_AGENT || "SIDIM-Visitas/0.1 (configure GEOCODING_USER_AGENT)";
