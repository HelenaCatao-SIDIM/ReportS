/*
 * Datas e horas. O sistema guarda em ISO (UTC) e exibe no horário de Brasília.
 * America/Sao_Paulo não tem horário de verão desde 2019, então o fuso é fixo em -03:00.
 */

const FUSO = "America/Sao_Paulo";
const OFFSET = "-03:00";

export function formatarData(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

export function formatarHora(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export const formatarDataHora = (iso: string) => `${formatarData(iso)} ${formatarHora(iso)}`;

/** Duração entre duas datas: "2h 15min", "45min". */
export function formatarDuracao(inicio: string, fim: string | number) {
  const min = Math.max(0, Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 60000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? ` ${String(m).padStart(2, "0")}min` : ""}` : `${m}min`;
}

/** ISO → valor de <input type="datetime-local"> no horário de Brasília ("2026-10-24T14:30"). */
export function paraInputLocal(iso: string) {
  const d = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}

/** Valor de <input type="datetime-local"> (horário de Brasília) → ISO, ou null se inválido. */
export function deInputLocal(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return null;
  const d = new Date(`${valor}:00${OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** "2026-10-01" (data no horário de Brasília) → início do dia em ISO. */
export const inicioDoDia = (data: string) => new Date(`${data}T00:00:00${OFFSET}`).toISOString();
export const fimDoDia = (data: string) => new Date(`${data}T23:59:59.999${OFFSET}`).toISOString();

/** Data (AAAA-MM-DD) no horário de Brasília para um instante. */
export const dataLocal = (ms: number) => new Date(ms - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Períodos rápidos (datas AAAA-MM-DD no horário de Brasília) a partir de "agora". */
export function periodosRapidos(agora: number) {
  const hoje = dataLocal(agora);
  const [a, m] = hoje.split("-").map(Number);
  const ultimoDia = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const mm = (n: number) => String(n).padStart(2, "0");
  const [ap, mp] = m === 1 ? [a - 1, 12] : [a, m - 1];
  return {
    mes: { de: `${a}-${mm(m)}-01`, ate: `${a}-${mm(m)}-${ultimoDia(a, m)}` },
    mesPassado: { de: `${ap}-${mm(mp)}-01`, ate: `${ap}-${mm(mp)}-${ultimoDia(ap, mp)}` },
    noventa: { de: dataLocal(agora - 89 * 86400_000), ate: hoje },
  };
}
