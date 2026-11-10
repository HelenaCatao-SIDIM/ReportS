/* eslint-disable jsx-a11y/alt-text -- Image do react-pdf não tem atributo alt */
import "server-only";
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ConteudoCongelado, CronogramaCongelado, ResumoSuporte, VisitaDetalhada } from "@/lib/types";
import { formatarTempo, indicadores, linhaDoAtendimento, ordenarPorAbertura, tabulacoes } from "@/lib/chamados";
import { formatarData, formatarDataHora, formatarDuracao, formatarHora } from "@/lib/datas";
import { formatarCbo, formatarCnpj, mascararCpf } from "@/lib/format";
import { ROTULO_MEIO } from "@/lib/meio";
import { ehPresencial, formatarDataCurta, formatarMinutos, fotosDaLista, rotuloAtendidos, tituloAtendidos, rotuloTipo } from "@/lib/visitas";
import { ROTULO_SITUACAO_RELATORIO, equipesDoItem, resumoCronograma, situacaoNoRelatorio } from "@/lib/cronograma";
import { ASSINANTE, ASSINATURA, LOGO, linhasDaEmpresa } from "@/lib/sidim";
import { nomeDoRelatorio } from "@/lib/nome-pdf";
import type { MarcaPdf } from "@/lib/pdf/marca";

// Sem hifenização automática: em colunas estreitas o padrão quebrava palavras ("Recursos Hu-manos").
Font.registerHyphenationCallback((palavra) => [palavra]);

/** Imagens já carregadas (endereço → bytes), porque o react-pdf não busca URLs relativas. */
export type ImagensPdf = Map<string, { data: Buffer; format: "png" | "jpg" }>;

const AZUL = "#1d4ed8";
const CINZA = "#64748b";
const BORDA = "#e2e8f0";

const s = StyleSheet.create({
  pagina: { padding: 36, paddingBottom: 54, fontFamily: "Helvetica", fontSize: 9, color: "#0f172a" },
  rodape: { position: "absolute", bottom: 24, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: CINZA },
  marca: { fontSize: 9, color: AZUL, fontFamily: "Helvetica-Bold" },
  topo: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 26 },
  titulo: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  subtitulo: { fontSize: 11, color: CINZA, marginBottom: 24 },
  rotulo: { fontSize: 7.5, color: CINZA, marginBottom: 1.5, textTransform: "uppercase" },
  valor: { fontSize: 10 },
  grade: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  celula: { width: "33.33%", marginBottom: 8, paddingRight: 8 },
  caixa: { borderWidth: 1, borderColor: BORDA, borderRadius: 4, padding: 10, marginBottom: 10 },
  secao: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 6, marginTop: 4 },
  destaque: { fontSize: 20, fontFamily: "Helvetica-Bold", color: AZUL },
  tabela: { borderWidth: 1, borderColor: BORDA, borderRadius: 4, marginBottom: 10 },
  linha: { flexDirection: "row", borderBottomWidth: 1, borderColor: BORDA, paddingVertical: 4, paddingHorizontal: 6, alignItems: "center" },
  cabecalho: { backgroundColor: "#f1f5f9", fontFamily: "Helvetica-Bold", fontSize: 7.5, color: CINZA },
  visitaTitulo: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  fotos: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -3 },
  foto: { width: "25%", padding: 3 },
  imagem: { width: "100%", height: 95, objectFit: "cover", borderRadius: 3 },
  texto: { fontSize: 9, lineHeight: 1.4 },
  vazio: { fontSize: 9, color: CINZA },
});

function Campo({ rotulo, valor, largura = "33.33%" }: { rotulo: string; valor: string; largura?: string }) {
  return (
    <View style={[s.celula, { width: largura }]}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <Text style={s.valor}>{valor || "—"}</Text>
    </View>
  );
}

/** Logo com a proporção certa (altura em pontos). */
const tamanhoLogo = (altura: number) => ({ height: altura, width: Math.round((altura * LOGO.largura) / LOGO.altura) });

/** Cabeçalho da capa: logo à esquerda e os dados da SIDIM à direita. */
function CabecalhoPdf({ marca }: { marca?: MarcaPdf }) {
  const linhas = linhasDaEmpresa();
  return (
    <View style={s.topo}>
      {marca ? <Image src={marca.logo} style={tamanhoLogo(42)} /> : <Text style={s.marca}>SIDIM · Registro de visitas e treinamentos</Text>}
      <View style={{ alignItems: "flex-end", maxWidth: "55%" }}>
        {linhas.map((l, i) => (
          <Text key={i} style={{ fontSize: 7.5, marginBottom: 1, color: i === 0 ? "#0f172a" : CINZA, fontFamily: i === 0 ? "Helvetica-Bold" : "Helvetica" }}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Assinatura do responsável: a imagem fica sobre a linha, com o nome embaixo. */
function AssinaturaPdf({ marca }: { marca?: MarcaPdf }) {
  const largura = 190;
  return (
    <View wrap={false} style={{ marginTop: 22, width: 230 }}>
      {marca && <Image src={marca.assinatura} style={{ width: largura, height: Math.round((largura * ASSINATURA.altura) / ASSINATURA.largura), marginLeft: 8, marginBottom: -9 }} />}
      {!marca && <View style={{ height: 36 }} />}
      <View style={{ borderTopWidth: 0.75, borderTopColor: "#94a3b8" }} />
      <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 3 }}>{ASSINANTE.nome}</Text>
      <Text style={{ fontSize: 8, color: CINZA }}>{ASSINANTE.empresa}</Text>
    </View>
  );
}

function Rodape({ conteudo, versao }: { conteudo: ConteudoCongelado; versao: number }) {
  return (
    <View style={s.rodape} fixed>
      <Text>
        {conteudo.cliente.nome} · {conteudo.sistema.nome} · {formatarDataCurta(conteudo.de)} a {formatarDataCurta(conteudo.ate)} · v{versao}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

function Texto({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <Text style={valor ? s.texto : s.vazio}>{valor || "—"}</Text>
    </View>
  );
}

function PaginaVisita({ v, outroPeriodo, imagens, conteudo, versao, marca }: { v: VisitaDetalhada; outroPeriodo: boolean; imagens: ImagensPdf; conteudo: ConteudoCongelado; versao: number; marca?: MarcaPdf }) {
  const fotos = [v.fotoAmbiente, v.printTela, ...v.fotosExtras].filter((f): f is NonNullable<typeof f> => !!f && imagens.has(f.url));
  const temas = [...v.temas.map((t) => `${t.nome} (${t.sistemaNome} / ${t.modulo})`), ...(v.temaAdicional ? [`${v.temaAdicional} (adicional)`] : [])];

  return (
    <Page size="A4" style={s.pagina}>
      {marca && <Image src={marca.logo} style={{ ...tamanhoLogo(20), marginBottom: 10 }} />}
      <Text style={s.visitaTitulo}>
        {formatarData(v.entrada)} · {rotuloTipo(v.tipo)}
      </Text>
      <Text style={[s.subtitulo, { marginBottom: 12 }]}>
        {v.unidadeNome} · {rotuloAtendidos(v)}
        {outroPeriodo ? "   (visita de período anterior)" : ""}
      </Text>

      <View style={s.caixa}>
        <View style={s.grade}>
          <Campo rotulo="Estabelecimento" valor={v.unidadeNome} />
          <Campo rotulo={tituloAtendidos(v)} valor={rotuloAtendidos(v)} />
          <Campo rotulo="Técnico" valor={v.tecnicoNome} />
          <Campo rotulo="Registrado por" valor={ROTULO_MEIO[v.meio]} />
          <Campo rotulo="Entrada" valor={formatarHora(v.entrada)} />
          <Campo rotulo="Saída" valor={v.saida ? formatarHora(v.saida) : ""} />
          <Campo rotulo="Duração" valor={v.saida ? formatarDuracao(v.entrada, v.saida) : ""} />
          {!ehPresencial(v.tipo) && <Campo rotulo="Link da reunião" valor={v.linkReuniao ?? ""} largura="100%" />}
        </View>
      </View>

      <Text style={s.secao}>Temas</Text>
      {!!v.equipes?.length && <Text style={[s.texto, { marginBottom: 3 }]}>Equipes treinadas: {v.equipes.join(", ")}</Text>}
      <View style={{ marginBottom: 8 }}>
        {temas.length ? temas.map((t) => <Text key={t} style={s.texto}>• {t}</Text>) : <Text style={s.vazio}>Nenhum tema registrado.</Text>}
      </View>

      <Texto rotulo="Observações" valor={v.observacoes} />
      <Texto rotulo="Pendências" valor={v.pendencias} />
      <Texto rotulo="Próximos passos" valor={v.proximosPassos} />

      <Text style={s.secao}>Participantes ({v.presencas.length})</Text>
      {v.presencas.length ? (
        <View style={s.tabela}>
          <View style={[s.linha, s.cabecalho]}>
            <Text style={{ width: "26%" }}>Nome</Text>
            <Text style={{ width: "28%" }}>CBO</Text>
            <Text style={{ width: "15%" }}>Setor</Text>
            <Text style={{ width: "15%" }}>CPF</Text>
            <Text style={{ width: "16%" }}>Confirmação</Text>
          </View>
          {v.presencas.map((p) => {
            const assinatura = p.assinatura ? imagens.get(p.assinatura) : undefined;
            return (
              <View key={p.participanteId} style={s.linha} wrap={false}>
                <Text style={{ width: "26%" }}>{p.nome}</Text>
                <Text style={{ width: "28%", fontSize: 8 }}>
                  {p.cbo ? `${formatarCbo(p.cbo.codigo)} ${p.cbo.titulo}` : "—"}
                </Text>
                <Text style={{ width: "15%" }}>{p.setor || "—"}</Text>
                <Text style={{ width: "15%" }}>{p.cpf ? mascararCpf(p.cpf) : "—"}</Text>
                <View style={{ width: "16%" }}>
                  {p.confirmacao === "assinatura" && assinatura ? <Image src={assinatura} style={{ height: 20, objectFit: "contain" }} /> : <Text>Nominal</Text>}
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={[s.vazio, { marginBottom: 8 }]}>
          {fotosDaLista(v).length ? "Presença registrada pela foto da lista de presença (nas fotos da visita)." : "Nenhum participante registrado."}
        </Text>
      )}

      <Text style={s.secao}>Fotos ({fotos.length})</Text>
      {fotos.length ? (
        <View style={s.fotos}>
          {fotos.map((f) => (
            <View key={f.id} style={s.foto} wrap={false}>
              <Image src={imagens.get(f.url)!} style={s.imagem} />
            </View>
          ))}
        </View>
      ) : (
        <Text style={s.vazio}>Nenhuma foto.</Text>
      )}
      <Rodape conteudo={conteudo} versao={versao} />
    </Page>
  );
}

const COR_INDICADOR = { azul: "#1d4ed8", verde: "#0f766e", roxo: "#6d28d9", ambar: "#b45309" } as const;
const BORDA_INDICADOR = { azul: "#1d4ed8", verde: "#0d9488", roxo: "#7c3aed", ambar: "#d97706" } as const;

/** Um número do painel de atendimentos: rótulo, valor grande e uma frase curta. */
function IndicadorPdf({ cor, rotulo, valor, legenda }: { cor: keyof typeof COR_INDICADOR; rotulo: string; valor: string; legenda: string }) {
  return (
    <View style={{ width: "24.2%", borderWidth: 1, borderColor: BORDA, borderTopWidth: 3, borderTopColor: BORDA_INDICADOR[cor], borderRadius: 4, paddingHorizontal: 7, paddingVertical: 6 }}>
      <Text style={[s.rotulo, { marginBottom: 2 }]}>{rotulo}</Text>
      <Text style={{ fontSize: 19, fontFamily: "Helvetica-Bold", color: COR_INDICADOR[cor], marginBottom: 1 }}>{valor}</Text>
      <Text style={{ fontSize: 6.8, color: CINZA }}>{legenda}</Text>
    </View>
  );
}

/** Painel dos atendimentos do suporte na capa (igual no relatório sintético e no analítico): indicadores e contagem por tabulação. */
function ChamadosSuportePdf({ r }: { r: ResumoSuporte }) {
  if (r.situacao === "sem_vinculo" || r.situacao === "nao_configurado") return null;
  const ind = indicadores(r);
  const linhas = tabulacoes(r);
  const maior = Math.max(...linhas.map((l) => l.quantidade), 1);
  return (
    <View>
      <Text style={s.secao}>Atendimentos do suporte</Text>
      {r.situacao === "indisponivel" ? (
        <View style={s.caixa}>
          <Text style={s.vazio}>Dados de suporte indisponíveis no momento da emissão.</Text>
        </View>
      ) : r.totalAbertosEFechados === 0 ? (
        <View style={s.caixa}>
          <Text style={s.vazio}>Nenhum atendimento no período.</Text>
        </View>
      ) : (
        <>
          <View wrap={false} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <IndicadorPdf cor="azul" rotulo="Atendimentos" valor={String(ind.total)} legenda="abertos e fechados no período" />
            <IndicadorPdf cor="verde" rotulo="Espera média" valor={formatarTempo(ind.esperaMediaMin)} legenda="até o atendente responder" />
            <IndicadorPdf cor="roxo" rotulo="Atendimento médio" valor={formatarTempo(ind.atendimentoMedioMin)} legenda="por atendimento" />
            <IndicadorPdf cor="ambar" rotulo="Tempo total dedicado" valor={formatarTempo(ind.tempoTotalMin)} legenda="soma de todos os atendimentos" />
          </View>
          <View wrap={false} style={[s.tabela, { marginBottom: 10 }]}>
            <View style={[s.linha, s.cabecalho, { justifyContent: "space-between" }]}>
              <Text>POR TABULAÇÃO</Text>
              <Text style={{ fontFamily: "Helvetica" }}>{r.totalAbertosEFechados} atendimentos</Text>
            </View>
            {linhas.map((l, i) => (
              <View key={l.nome} style={[s.linha, { paddingVertical: 5, borderBottomWidth: i === linhas.length - 1 ? 0 : 0.5 }]}>
                <Text style={{ width: "38%", fontSize: 8.5 }}>{l.nome}</Text>
                <View style={{ width: "46%", height: 6, backgroundColor: "#eef2f7", borderRadius: 3 }}>
                  <View style={{ width: `${(l.quantidade / maior) * 100}%`, height: 6, backgroundColor: l.neutra ? "#94a3b8" : AZUL, borderRadius: 3 }} />
                </View>
                <Text style={{ width: "8%", textAlign: "right", fontSize: 11, fontFamily: "Helvetica-Bold" }}>{l.quantidade}</Text>
                <Text style={{ width: "8%", textAlign: "right", fontSize: 7.5, color: CINZA }}>{l.percentual}%</Text>
              </View>
            ))}
          </View>
        </>
      )}
      {r.situacao === "ok" && <Text style={[s.vazio, { fontSize: 7.5, marginBottom: 8 }]}>Fonte: atendimentos do suporte (Fortics), consultados em {formatarDataHora(r.consultadoEm)}.</Text>}
    </View>
  );
}

/** Linhas por página da lista analítica (o cabeçalho da tabela se repete em cada página). */
const ATENDIMENTOS_POR_PAGINA = 20;

/** Lista de todos os atendimentos do período (relatório analítico), do mais antigo ao mais recente, sem protocolo. */
function PaginasAtendimentosPdf({ r, conteudo, versao, marca }: { r: ResumoSuporte; conteudo: ConteudoCongelado; versao: number; marca?: MarcaPdf }) {
  const linhas = ordenarPorAbertura(r.chamados).map(linhaDoAtendimento);
  if (!linhas.length) return null;
  const paginas = Array.from({ length: Math.ceil(linhas.length / ATENDIMENTOS_POR_PAGINA) }, (_, i) => linhas.slice(i * ATENDIMENTOS_POR_PAGINA, (i + 1) * ATENDIMENTOS_POR_PAGINA));
  return (
    <>
      {paginas.map((grupo, p) => (
        <Page key={p} size="A4" style={s.pagina}>
          {marca && <Image src={marca.logo} style={{ ...tamanhoLogo(20), marginBottom: 10 }} />}
          <Text style={s.visitaTitulo}>Atendimentos do suporte — lista completa</Text>
          <Text style={[s.subtitulo, { marginBottom: 10, fontSize: 9.5 }]}>
            {linhas.length} {linhas.length === 1 ? "atendimento" : "atendimentos"} de {formatarDataCurta(conteudo.de)} a {formatarDataCurta(conteudo.ate)}, do mais antigo ao mais recente
            {paginas.length > 1 ? ` · página ${p + 1} de ${paginas.length} da lista` : ""}
          </Text>
          <View style={s.tabela}>
            <View style={[s.linha, s.cabecalho]}>
              <Text style={{ width: "14%" }}>DATA E HORÁRIO</Text>
              <Text style={{ width: "8%" }}>TEMPO</Text>
              <Text style={{ width: "19%" }}>SOLICITANTE</Text>
              <Text style={{ width: "15%" }}>TÉCNICO</Text>
              <Text style={{ width: "25%" }}>ASSUNTO</Text>
              <Text style={{ width: "19%" }}>TABULAÇÃO</Text>
            </View>
            {grupo.map((l, i) => (
              <View key={i} style={[s.linha, { alignItems: "flex-start" }]} wrap={false}>
                <View style={{ width: "14%" }}>
                  <Text>{l.dia}</Text>
                  <Text style={{ color: CINZA, fontSize: 7.5 }}>{l.horario}</Text>
                </View>
                <Text style={{ width: "8%", fontFamily: "Helvetica-Bold" }}>{l.tempo}</Text>
                <Text style={{ width: "19%", paddingRight: 4 }}>{l.solicitante}</Text>
                <Text style={{ width: "15%", paddingRight: 4 }}>{l.tecnico}</Text>
                <Text style={{ width: "25%", paddingRight: 4 }}>{l.assunto}</Text>
                <Text style={{ width: "19%" }}>{l.tabulacao}</Text>
              </View>
            ))}
          </View>
          <Rodape conteudo={conteudo} versao={versao} />
        </Page>
      ))}
    </>
  );
}

/** Cronograma de implantação do contrato, na situação congelada da emissão. */
export function CronogramaPdf({ c }: { c: CronogramaCongelado }) {
  return (
    <View style={s.caixa}>
      <Text style={s.secao}>Cronograma de implantação</Text>
      <Text style={[s.vazio, { marginBottom: 6 }]}>
        {resumoCronograma(c)} · situação em {formatarDataCurta(c.em)}
      </Text>
      <View style={s.tabela}>
        <View style={[s.linha, s.cabecalho]}>
          <Text style={{ width: "28%" }}>Estabelecimento</Text>
          <Text style={{ width: "22%" }}>Equipes</Text>
          <Text style={{ width: "18%" }}>Atividade</Text>
          <Text style={{ width: "14%" }}>Prazo</Text>
          <Text style={{ width: "18%" }}>Situação</Text>
        </View>
        {c.itens.map((i, n) => (
          <View key={n} style={s.linha} wrap={false}>
            <Text style={{ width: "28%" }}>{i.unidadeNome}</Text>
            <Text style={{ width: "22%" }}>{equipesDoItem(i)}</Text>
            <Text style={{ width: "18%" }}>{rotuloTipo(i.tipo)}</Text>
            <Text style={{ width: "14%" }}>{formatarDataCurta(i.prazo)}</Text>
            <Text style={{ width: "18%" }}>
              {ROTULO_SITUACAO_RELATORIO[situacaoNoRelatorio(i.situacao)]}
              {i.cumpridoEm ? ` (${formatarDataCurta(i.cumpridoEm)})` : ""}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function RelatorioPdf({
  conteudo,
  versao,
  emitidoEm,
  imagens,
  marca,
  previa = false,
}: {
  conteudo: ConteudoCongelado;
  versao: number;
  emitidoEm: string;
  imagens: ImagensPdf;
  /** Logo e assinatura da SIDIM (ver `carregarMarcaPdf`). Sem elas, o PDF sai com o cabeçalho em texto e a linha de assinatura em branco. */
  marca?: MarcaPdf;
  /** Prévia do relatório (ainda não emitido): leva um aviso na capa e "PRÉVIA" no nome. */
  previa?: boolean;
}) {
  const c = conteudo;
  return (
    <Document title={nomeDoRelatorio({ tipo: c.relatorioAtendimentos, cliente: c.cliente.nome, sistema: c.sistema.nome, de: c.de, ate: c.ate, versao, previa })} author="SIDIM" language="pt-BR">
      <Page size="A4" style={s.pagina}>
        <CabecalhoPdf marca={marca} />
        <Text style={s.titulo}>Relatório de atendimento</Text>
        <Text style={s.subtitulo}>
          Período de {formatarDataCurta(c.de)} a {formatarDataCurta(c.ate)} · {previa ? `prévia da versão v${versao} (ainda não emitida)` : `versão v${versao}`}
        </Text>
        {previa && (
          <View style={{ backgroundColor: "#fef3c7", borderWidth: 1, borderColor: "#fcd34d", borderRadius: 4, padding: 6, marginBottom: 10 }}>
            <Text style={{ fontSize: 8.5, color: "#92400e", fontFamily: "Helvetica-Bold" }}>PRÉVIA: este documento ainda não foi emitido e pode mudar até a emissão.</Text>
          </View>
        )}

        <View style={s.caixa}>
          <View style={s.grade}>
            <Campo rotulo="Cliente" valor={c.cliente.nome} largura="66.66%" />
            <Campo rotulo="CNPJ" valor={formatarCnpj(c.cliente.cnpj)} />
            <Campo rotulo="Sistema" valor={c.sistema.nome} />
            <Campo rotulo="Contrato" valor={c.cliente.contrato} largura="66.66%" />
            <Campo rotulo="Período" valor={`${formatarDataCurta(c.de)} a ${formatarDataCurta(c.ate)}`} />
            <Campo rotulo="Emitido em" valor={formatarDataHora(emitidoEm)} />
            <Campo rotulo="Visitas" valor={String(c.visitas.length)} />
          </View>
        </View>

        {c.visitas.length > 0 && (
          <View style={[s.caixa, { flexDirection: "row" }]}>
            <View style={{ width: "50%" }}>
              <Text style={s.rotulo}>Total de horas presenciais</Text>
              <Text style={s.destaque}>{formatarMinutos(c.minutosPresenciais)}</Text>
            </View>
            {c.minutosOnline > 0 && (
              <View style={{ width: "50%" }}>
                <Text style={s.rotulo}>Treinamento online</Text>
                <Text style={[s.destaque, { fontSize: 14 }]}>{formatarMinutos(c.minutosOnline)}</Text>
              </View>
            )}
          </View>
        )}

        {c.suporte && <ChamadosSuportePdf r={c.suporte} />}

        {c.cronograma && <CronogramaPdf c={c.cronograma} />}

        <Text style={s.secao}>Visitas do período</Text>
        {c.visitas.length === 0 && <Text style={[s.vazio, { marginBottom: 6 }]}>Nenhuma visita registrada no período.</Text>}
        {c.visitas.length > 0 && (
          <View style={s.tabela}>
            <View style={[s.linha, s.cabecalho]}>
              <Text style={{ width: "14%" }}>Data</Text>
              <Text style={{ width: "22%" }}>Tipo</Text>
              <Text style={{ width: "30%" }}>Estabelecimento / setor</Text>
              <Text style={{ width: "20%" }}>Horário</Text>
              <Text style={{ width: "14%" }}>Duração</Text>
            </View>
            {c.visitas.map((v) => (
              <View key={v.id} style={s.linha} wrap={false}>
                <Text style={{ width: "14%" }}>{formatarData(v.entrada)}</Text>
                <Text style={{ width: "22%" }}>{rotuloTipo(v.tipo)}</Text>
                <Text style={{ width: "30%" }}>
                  {v.unidadeNome} · {rotuloAtendidos(v)}
                </Text>
                <Text style={{ width: "20%" }}>
                  {formatarHora(v.entrada)}–{v.saida ? formatarHora(v.saida) : "—"}
                </Text>
                <Text style={{ width: "14%" }}>{v.saida ? formatarDuracao(v.entrada, v.saida) : "—"}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={s.vazio}>Os CPFs dos participantes aparecem mascarados neste documento.</Text>
        <AssinaturaPdf marca={marca} />
        <Rodape conteudo={c} versao={versao} />
      </Page>

      {c.relatorioAtendimentos === "analitico" && c.suporte?.situacao === "ok" && <PaginasAtendimentosPdf r={c.suporte} conteudo={c} versao={versao} marca={marca} />}

      {c.visitas.map((v) => (
        <PaginaVisita key={v.id} v={v} outroPeriodo={c.deOutroPeriodo.includes(v.id)} imagens={imagens} conteudo={c} versao={versao} marca={marca} />
      ))}
    </Document>
  );
}
