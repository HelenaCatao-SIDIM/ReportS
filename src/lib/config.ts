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

/** Identificação exigida pela política de uso do Nominatim (sistema + contato). */
export const geocodingUserAgent = () => process.env.GEOCODING_USER_AGENT || "SIDIM-Visitas/0.1 (configure GEOCODING_USER_AGENT)";
