/* eslint-disable jsx-a11y/alt-text -- Image do react-pdf não tem atributo alt */
import "server-only";
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ConteudoCongelado, VisitaDetalhada } from "@/lib/types";
import { formatarData, formatarDataHora, formatarDuracao, formatarHora } from "@/lib/datas";
import { formatarCbo, formatarCnpj, mascararCpf } from "@/lib/format";
import { ehPresencial, formatarDataCurta, formatarMinutos, rotuloTipo } from "@/lib/visitas";

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
  marca: { fontSize: 9, color: AZUL, fontFamily: "Helvetica-Bold", marginBottom: 32 },
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

function Rodape({ conteudo, versao }: { conteudo: ConteudoCongelado; versao: number }) {
  return (
    <View style={s.rodape} fixed>
      <Text>
        {conteudo.cliente.nome} · {formatarDataCurta(conteudo.de)} a {formatarDataCurta(conteudo.ate)} · v{versao}
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

function PaginaVisita({ v, outroPeriodo, imagens, conteudo, versao }: { v: VisitaDetalhada; outroPeriodo: boolean; imagens: ImagensPdf; conteudo: ConteudoCongelado; versao: number }) {
  const fotos = [v.fotoAmbiente, v.printTela, ...v.fotosExtras].filter((f): f is NonNullable<typeof f> => !!f && imagens.has(f.url));
  const temas = [...v.temas.map((t) => `${t.nome} (${t.sistema} / ${t.modulo})`), ...(v.temaAdicional ? [`${v.temaAdicional} (adicional)`] : [])];

  return (
    <Page size="A4" style={s.pagina}>
      <Text style={s.visitaTitulo}>
        {formatarData(v.entrada)} · {rotuloTipo(v.tipo)}
      </Text>
      <Text style={[s.subtitulo, { marginBottom: 12 }]}>
        {v.unidadeNome} · {v.setorNome}
        {outroPeriodo ? "   (visita de período anterior)" : ""}
      </Text>

      <View style={s.caixa}>
        <View style={s.grade}>
          <Campo rotulo="Unidade" valor={v.unidadeNome} />
          <Campo rotulo="Setor" valor={v.setorNome} />
          <Campo rotulo="Técnico" valor={v.tecnicoNome} />
          <Campo rotulo="Entrada" valor={formatarHora(v.entrada)} />
          <Campo rotulo="Saída" valor={v.saida ? formatarHora(v.saida) : ""} />
          <Campo rotulo="Duração" valor={v.saida ? formatarDuracao(v.entrada, v.saida) : ""} />
          {!ehPresencial(v.tipo) && <Campo rotulo="Link da reunião" valor={v.linkReuniao ?? ""} largura="100%" />}
        </View>
      </View>

      <Text style={s.secao}>Temas</Text>
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
                  {formatarCbo(p.cbo.codigo)} {p.cbo.titulo}
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
        <Text style={[s.vazio, { marginBottom: 8 }]}>Nenhum participante registrado.</Text>
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

export function RelatorioPdf({ conteudo, versao, emitidoEm, imagens }: { conteudo: ConteudoCongelado; versao: number; emitidoEm: string; imagens: ImagensPdf }) {
  const c = conteudo;
  return (
    <Document title={`Relatório ${c.cliente.nome} ${formatarDataCurta(c.de)} a ${formatarDataCurta(c.ate)} v${versao}`} author="SIDIM" language="pt-BR">
      <Page size="A4" style={s.pagina}>
        <Text style={s.marca}>SIDIM · Registro de visitas e treinamentos</Text>
        <Text style={s.titulo}>Relatório de atendimento</Text>
        <Text style={s.subtitulo}>
          Período de {formatarDataCurta(c.de)} a {formatarDataCurta(c.ate)} · versão v{versao}
        </Text>

        <View style={s.caixa}>
          <View style={s.grade}>
            <Campo rotulo="Cliente" valor={c.cliente.nome} largura="66.66%" />
            <Campo rotulo="CNPJ" valor={formatarCnpj(c.cliente.cnpj)} />
            <Campo rotulo="Contrato" valor={c.cliente.contrato} largura="100%" />
            <Campo rotulo="Período" valor={`${formatarDataCurta(c.de)} a ${formatarDataCurta(c.ate)}`} />
            <Campo rotulo="Emitido em" valor={formatarDataHora(emitidoEm)} />
            <Campo rotulo="Visitas" valor={String(c.visitas.length)} />
          </View>
        </View>

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

        <Text style={s.secao}>Visitas do período</Text>
        <View style={s.tabela}>
          <View style={[s.linha, s.cabecalho]}>
            <Text style={{ width: "14%" }}>Data</Text>
            <Text style={{ width: "22%" }}>Tipo</Text>
            <Text style={{ width: "30%" }}>Unidade / setor</Text>
            <Text style={{ width: "20%" }}>Horário</Text>
            <Text style={{ width: "14%" }}>Duração</Text>
          </View>
          {c.visitas.map((v) => (
            <View key={v.id} style={s.linha} wrap={false}>
              <Text style={{ width: "14%" }}>{formatarData(v.entrada)}</Text>
              <Text style={{ width: "22%" }}>{rotuloTipo(v.tipo)}</Text>
              <Text style={{ width: "30%" }}>
                {v.unidadeNome} · {v.setorNome}
              </Text>
              <Text style={{ width: "20%" }}>
                {formatarHora(v.entrada)}–{v.saida ? formatarHora(v.saida) : "—"}
              </Text>
              <Text style={{ width: "14%" }}>{v.saida ? formatarDuracao(v.entrada, v.saida) : "—"}</Text>
            </View>
          ))}
        </View>
        <Text style={s.vazio}>Os CPFs dos participantes aparecem mascarados neste documento.</Text>
        <Rodape conteudo={c} versao={versao} />
      </Page>

      {c.visitas.map((v) => (
        <PaginaVisita key={v.id} v={v} outroPeriodo={c.deOutroPeriodo.includes(v.id)} imagens={imagens} conteudo={c} versao={versao} />
      ))}
    </Document>
  );
}
