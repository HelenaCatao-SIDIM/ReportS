# Regras de negócio — SIDIM Visitas

Este documento descreve as regras que o sistema aplica em produção (desde 30/10/2026: dados no PostgreSQL, login no cadastro único da SIDIM),
levantadas a partir do código. O código continua sendo a fonte da verdade: cada seção indica onde a regra está implementada.
**Ao mudar uma regra no código, atualize este documento no mesmo commit.**

As regras com código `RN-PL-xx` são da Plataforma SIDIM e estão na Especificação do SINC (`docs/produto/2-especificacao-funcional.md`, seção 13).

## Visão geral do fluxo

1. **Técnico** faz o check-in no cliente, escolhendo o **sistema** (o contrato) → a visita fica **em andamento** (temas, fotos extras, lista de presença).
2. **Técnico** faz o check-out → a visita fica **encerrada**.
3. A **Administração** cria o **relatório** do contrato (cliente + sistema) para um período (rascunho) e o **emite**: PDF + e-mail para os aprovadores do contrato (v1).
4. **Aprovador** abre o link do e-mail e **aprova** ou **pede ajuste**.
5. Se pediu ajuste, a Administração corrige as visitas e emite a próxima versão (v2, v3…), que volta para o passo 4.

## Acesso e permissões

- O login é com o **e-mail e a senha do cadastro único da SIDIM**, os mesmos do SINC. Usuários, papéis e senhas são gerenciados no Admin do SINC; o ReportS só lê. A tela "Usuários e permissões" é só de leitura: explica que isso fica no SINC e mostra, para cada permissão do ReportS, se a pessoa a tem.
- O e-mail não diferencia maiúsculas de minúsculas. Usuário **inativo** não entra. Quem não tem nenhuma permissão `reports.*` não entra ("Seu usuário não tem acesso ao ReportS", RN-PL-61).
- Até **10 tentativas de login em 3 minutos por IP**, certas ou erradas (RN-PL-55).
- O que cada pessoa faz vem das **permissões** dos seus papéis (RN-PL-60). O catálogo do ReportS é registrado na plataforma a cada deploy:

| Permissão | O que libera |
|---|---|
| `reports.tecnico` | App do Técnico: check-in, visita, presenças, check-out e o próprio histórico |
| `reports.clientes.cadastrar` | Criar cliente à mão; editar nome, CNPJ e nomes no Fortics; estabelecimentos e setores |
| `reports.contratos.gerenciar` | Contratos, tipo de comprovação, exigência de CPF e aprovadores |
| `reports.temas.gerenciar` | Temas das visitas |
| `reports.participantes.gerenciar` | Ver e editar participantes (CPF, CBO, setor) e criar provisórios fora de uma visita |
| `reports.participantes.revisar` | Reservada para a junção de participantes (Fase 5); ainda sem tela |
| `reports.visitas.gerenciar` | Ver todas as visitas; corrigir, encerrar e cancelar |
| `reports.relatorios.gerenciar` | Criar rascunho, emitir, reenviar e acompanhar relatórios, e a Caixa de saída de e-mails |

- O papel **Administrador** é protegido: tem todas as permissões ativas, inclusive as que forem criadas depois (RN-PL-63).
- Qualquer permissão do ReportS além de `reports.tecnico` dá acesso à **Administração**, que mostra só as telas permitidas. Quem tem as duas áreas escolhe em `/inicio` ("Para onde você quer ir?"); quem tem uma vai direto. Quem tenta abrir uma tela sem permissão volta a `/inicio` (ou ao início da Administração, com aviso).
- As permissões são lidas do cadastro **a cada requisição**, sem cache: mudar o papel, a permissão ou inativar a pessoa vale na próxima tela ou ação (RN-PL-64).
- A sessão dura **12 horas** (JWT assinado com `SESSION_SECRET`, em cookie httpOnly, guardando só o id do usuário). As páginas e as ações conferem usuário ativo e permissão; usuário inativado perde o acesso mesmo com a sessão válida.
- **Sair é uma ação (botão), nunca um link.** O Next.js pré-carrega os links visíveis na versão publicada, e um `GET` que apaga a sessão desconectaria a pessoa logo depois do login (defeito de 30/10/2026). A rota `/sair` só atende os redirecionamentos do sistema (quando o usuário da sessão não existe mais), ignora pré-carga e redireciona com endereço relativo.
- O **aprovador do cliente** não tem login: entra em `/aprovacao/<token>` pelo link pessoal do e-mail.

Onde: `src/proxy.ts`, `src/lib/dal.ts`, `src/lib/session.ts`, `src/lib/permissoes.ts`, `src/lib/limite-login.ts`, `src/app/actions/auth.ts`, `src/app/sair/route.ts`, `src/app/inicio/page.tsx`, `src/lib/repo/usuarios.ts`.

## Cadastros

### Clientes

- Um cliente existe de dois jeitos: **vindo do SINC** (o tenant abre o painel e depois é ligado a um cliente, por CNPJ, no Admin do SINC) ou **criado à mão** na Administração (`reports.clientes.cadastrar`). Cada **sistema do cliente** é um tenant do SINC; só aparecem os que estão "em implantação" (criados à mão) ou "vinculados" a um cliente; os "sem cliente" e os "unidos" a outro ficam de fora.
- Nome com pelo menos 2 caracteres; **CNPJ válido** (dígitos verificadores) e **único**. Um cliente que veio do SINC pode seguir sem CNPJ até alguém informá-lo (RN-PL-11).
- Cliente ligado ao ClickUp tem o **nome travado**: o campo é só de leitura e o nome enviado é ignorado (RN-PL-12).
- Cliente criado à mão precisa de **pelo menos um sistema**, da lista de sistemas ativos da plataforma; depois dá para acrescentar outros, sem repetir um que o cliente já tem.
- **Nomes no Fortics**: um por linha, no máximo 10, até 120 caracteres cada, sem repetir (sem diferenciar acento e maiúsculas). O campo só aparece com os chamados de suporte ligados.
- Cliente **inativo** não aparece no check-in.

Onde: `src/app/admin/clientes/actions.ts`, `src/lib/repo/clientes.ts`.

### Contratos e aprovadores

- Há **um contrato por sistema do cliente**. Ele tem: o **texto do contrato** (obrigatório; aparece na capa do relatório), o **nível de comprovação** da presença, se **exige CPF** dos participantes e se está **ativo** (nasce ativo; a caixa só existe na edição).
- Nível de comprovação: **Nominal** — a lista de presença tem só os dados das pessoas; **Assinada** — cada pessoa assina no celular do técnico (só em visitas presenciais; veja [Lista de presença](#lista-de-presença)).
- Pelo menos **um aprovador ativo** por contrato: marcado na lista do cadastro de aprovadores ou cadastrado ali mesmo.
- **Aprovadores** têm um cadastro único: nome obrigatório e **e-mail válido e único** no cadastro; cargo opcional.
- Só contrato **ativo** aparece no check-in e na criação de relatório.

Onde: `src/app/admin/clientes/contrato-actions.ts`, `src/app/admin/aprovadores/actions.ts`, `src/lib/repo/contratos.ts`, `src/lib/repo/aprovadores.ts`.

### Estabelecimentos e setores

- Estabelecimento: nome obrigatório e endereço. Latitude (−90 a 90) e longitude (−180 a 180) são opcionais. O **raio de verificação** é um número inteiro de metros, de **10 a 5000** (padrão 50; vazio volta ao padrão).
- Setor: nome obrigatório, **sem repetir dentro do estabelecimento**.
- Estabelecimento ou setor **com visitas registradas não é removido**: a tela explica o motivo.
- Opcional (`BUSCA_COORDENADAS`): botão que preenche latitude e longitude pelo endereço (Nominatim); acerta a rua, não a porta, então os campos continuam editáveis.

Onde: `src/app/admin/clientes/actions.ts`, `src/app/admin/clientes/geo-actions.ts`, `src/lib/repo/clientes.ts`.

### Temas

- Um tema é a combinação **nome + sistema + módulo**, todos obrigatórios, e a combinação não pode se repetir. O sistema é um dos cadastrados na plataforma.
- Se o sistema ou o módulo digitado só difere de um já cadastrado em acento ou maiúsculas, o sistema usa a grafia já existente.
- Não há exclusão: o tema é **inativado**. Tema inativo não aparece para o técnico, mas continua nas visitas em que já estava marcado.

Onde: `src/app/admin/temas/actions.ts`, `src/lib/repo/temas.ts`.

### Participantes

- Ficam na tabela de participantes da plataforma (comum com o SINC), **por sistema do cliente**. Há dois tipos: o **confirmado**, que vem do ERP pelo painel do SINC (o nome vem do ERP e o telefone é editado no SINC), e o **provisório**, criado no ReportS sem usuário do ERP, pelo técnico em campo ou pela Administração. Os já unidos (Fase 5) ficam de fora.
- O ReportS grava só **CPF, CBO e setor** (e o nome, no provisório): é o que o banco permite a esse usuário (ADR-035 do SINC).
- Cadastro de **provisório**: nome com pelo menos 3 caracteres, **ocupação CBO escolhida da tabela**, setor opcional e CPF **só quando o contrato exige** (precisa ser válido). Os confirmados chegam do SINC **sem ocupação**: aparecem com "—" até alguém preenchê-la na Administração.
- O **CPF é único por sistema do cliente** (entre os não unidos; o banco também garante). Ele pode ser guardado desde a decisão de LGPD de 30/10/2026 (QA-009 do SINC); o SINC nunca o mostra.
- **Antes de criar** (RN-PL-34), o sistema procura quem já tem o mesmo CPF (bloqueia: "Este CPF já está cadastrado em …") e quem tem **nome igual ou parecido** (sem acento; semelhança de pelo menos 0,75): pede a confirmação de que é outra pessoa.
- O **CPF completo** aparece só para a Administração, na tela de detalhe da visita. No PDF, na página do aprovador e nas sugestões do técnico aparece mascarado: `***.456.789-**`.

Onde: `src/app/admin/participantes/actions.ts`, `src/lib/repo/participantes.ts`, `src/lib/similaridade.ts`, `src/lib/format.ts`.

### Tabela CBO

- É a tabela **oficial** do Ministério do Trabalho (2.694 ocupações carregadas em 30/10/2026). Busca pelo título (sem acento) ou pelo código; o código tem 6 dígitos e é exibido como `4110-10`.
- A carga é por script (`npm run cbo:importar -- <arquivo>`): inclui as ocupações novas, atualiza títulos, recusa arquivo com menos de 1.000 ocupações e **nunca apaga** (presenças antigas guardam o código).

Onde: `src/lib/repo/cbo.ts`, `scripts/importar-cbo.ts`.

## Visitas (App do Técnico)

### Tipos de visita

| Tipo | Presencial | Exige participante no check-out |
|---|---|---|
| Treinamento | sim | **sim** |
| Implantação | sim | não |
| Suporte presencial | sim | não |
| Reunião | sim | não |
| Visita técnica | sim | não |
| Treinamento online | não | **sim** |

Onde: `src/lib/visitas.ts` (`TIPOS_VISITA`), `src/lib/regras-visita.ts` (`exigeParticipantes`).

### Check-in

- O técnico só pode ter **uma visita em andamento** por vez; o banco garante isso mesmo com dois check-ins ao mesmo tempo (o segundo é recusado).
- Escolhe, em cascata: cliente (ativo) → **sistema** (contrato ativo do cliente) → estabelecimento → setor (da lista do estabelecimento ou "outro", digitado) → tipo.
- **Presencial**: exige a **localização do aparelho** e a **foto do ambiente**. **Online**: exige o **print da tela da reunião** e o **link da reunião** (começando com `http://` ou `https://`).
- A hora de entrada é a **hora do servidor**, nunca a do aparelho.
- O sistema grava por **qual aparelho** o check-in foi feito (celular ou computador); aparece como "Registrado por" no detalhe, no relatório e na página do aprovador. No computador, a visita presencial mostra um aviso em tela, sem bloquear.
- **Raio do estabelecimento**: o check-in presencial grava a **distância medida** até o estabelecimento e o raio da época. Fora do raio, a Administração vê o selo "Fora do raio" e a distância; dentro, "Dentro do raio". É **só alerta, nunca bloqueia**, e o técnico, o aprovador e o PDF não veem. Só mede estabelecimentos com latitude e longitude.
- A localização é lida uma única vez, no check-in e no check-out. Não há rastreamento contínuo. O navegador só libera o GPS em `https` ou `localhost`.
- Opcional (`LOCALIZACAO_POR_CEP`): a coordenada vira **CEP e endereço**, e o CEP aparece no lugar da latitude e da longitude nas telas; a coordenada continua gravada. A falha das APIs nunca bloqueia o check-in: o CEP pendente é buscado depois, pelo timer a cada 30 minutos (até 200 por vez, 1 consulta por segundo). Com `CARIMBO_FOTO`, data, hora e CEP vão no rodapé da foto do ambiente.
- O que o técnico está digitando fica guardado no aparelho (`localStorage`) até cumprir o papel: o check-in (cliente, estabelecimento, setor, tipo e link; a foto e a localização são pedidas de novo), o tema adicional, o cadastro de novo participante (a assinatura não é guardada) e o check-out.

Onde: `src/app/tecnico/actions.ts`, `src/components/tecnico/use-gps.ts`, `src/lib/repo/visitas.ts` (`abrirVisita`), `src/lib/regras-visita.ts`.

### Durante a visita

Só o próprio técnico altera a visita, e só enquanto ela está em andamento:

- **Temas**: marca os temas ativos **do sistema do contrato** da visita (ou os que já estavam marcados, mesmo inativados depois);
- **Tema adicional**: texto livre de até 300 caracteres;
- **Fotos extras**: adiciona e remove.

Onde: `src/app/tecnico/visita/actions.ts`.

### Lista de presença

- O técnico busca a pessoa entre os participantes do **sistema do cliente** (por nome, ocupação ou setor). Se a pessoa não está cadastrada, o técnico cria um **participante provisório** ali mesmo, com as regras de [Participantes](#participantes) (nome, ocupação CBO, setor opcional, CPF só se o contrato exige, aviso de CPF repetido ou nome parecido).
- Se o contrato exige CPF e o participante escolhido ainda não tem, o técnico informa o CPF (só ele é gravado no cadastro).
- A mesma pessoa não entra duas vezes na lista.
- **Assinatura** é exigida quando o contrato é **Assinada** e a visita é **presencial**. Treinamento online é sempre nominal.
- A presença guarda uma **cópia** dos dados da pessoa naquele momento (nome, CBO, setor e CPF). Mudanças posteriores no cadastro não alteram visitas já registradas.

Onde: `src/app/tecnico/visita/participantes-actions.ts`.

### Check-out

- Treinamento e treinamento online: exigem **pelo menos um participante** na lista.
- Presencial: exige a **localização do aparelho**.
- Observações, pendências e próximos passos são opcionais, com até 4.000 caracteres cada.
- A hora de saída é a **hora do servidor**. Depois do check-out, o técnico **não altera mais** a visita.

Onde: `src/app/tecnico/visita/checkout-actions.ts`, `src/app/tecnico/visita/[id]/checkout/checkout-form.tsx`.

### Histórico do técnico

O técnico vê só as próprias visitas, filtradas por período: este mês, mês passado, últimos 90 dias ou datas escolhidas.

Onde: `src/app/tecnico/visitas/page.tsx`.

## Gestão de visitas (Administração, `reports.visitas.gerenciar`)

### Visitas em andamento

Aparecem da mais antiga para a mais recente, para que as esquecidas fiquem no topo; as abertas há 10 horas ou mais ganham destaque (nada é enviado). A Administração pode:

- **Encerrar** uma visita que o técnico esqueceu aberta: informa a data e a hora da saída (depois da entrada e não no futuro) e uma justificativa (pelo menos 5 caracteres). A visita fica marcada como **"encerrada pelo gestor"**.
- **Cancelar** um check-in feito por engano, com justificativa (pelo menos 5 caracteres). Visita cancelada **nunca entra em relatório**.

### Correção de visita encerrada

- Campos que podem ser corrigidos: entrada, saída (depois da entrada e não no futuro), tipo, estabelecimento (do mesmo cliente), setor, temas (só do sistema do contrato da visita; os já marcados continuam aceitos), tema adicional, observações, pendências e próximos passos. Também dá para **retirar** participantes da lista e fotos extras.
- Cliente, técnico, sistema, localizações, foto do ambiente e print não mudam.
- O **motivo** é obrigatório (pelo menos 5 caracteres). Se nada mudou, nada é gravado.
- Visita em **relatório aprovado** fica **travada**: ninguém altera.

### Histórico de alterações

Toda ação da Administração numa visita (encerramento, cancelamento ou correção) fica registrada com autor, data e hora, motivo e cada campo alterado (antes → depois).

Onde: `src/app/admin/visitas/actions.ts`, `src/lib/repo/visitas.ts`, `src/components/visita/detalhe-visita.tsx`.

## Relatórios (`reports.relatorios.gerenciar`)

### Status

| Status | Exibido como | Significado |
|---|---|---|
| `rascunho` | Rascunho | criado, ainda não emitido |
| `enviado` | Enviado | versão emitida, aguardando a decisão do cliente |
| `ajuste_solicitado` | Ajuste solicitado | o aprovador pediu correção; a Administração emite nova versão |
| `aprovado` | **Aprovado** | aprovado; relatório e visitas travados |

### Rascunho

- Um relatório é de um **contrato** (cliente + sistema) e de um período (data inicial e final, inclusive, no horário de Brasília), em geral um mês.
- O período **não pode cruzar** o de outro relatório do mesmo contrato.
- Entram as visitas **encerradas do contrato** com entrada até o fim do período e que **não estão em outro relatório**. Isso inclui visitas de períodos anteriores que ficaram de fora, marcadas como **"Período anterior"**.
- Sem nenhuma visita, o rascunho não é criado.
- As visitas ficam **reservadas** para o relatório e não entram em outro (duas criações ao mesmo tempo não disputam a mesma visita).
- **Atualizar visitas** recalcula a lista (ex.: uma visita esquecida foi encerrada depois). Vale para rascunho e ajuste solicitado.
- **Excluir** só vale para rascunho nunca emitido e libera as visitas.
- O relatório soma as **horas presenciais** e as **horas online** separadamente (saída − entrada de cada visita).

### Emissão

- Só pode emitir um relatório em rascunho ou com ajuste solicitado, com pelo menos uma visita, e o contrato precisa ter pelo menos um aprovador ativo.
- Cada emissão cria uma **versão** (v1, v2, …) com o conteúdo **congelado**: o PDF e a página do aprovador mostram exatamente o que foi emitido. Correções feitas depois não mudam uma versão já emitida.
- O **PDF** traz os CPFs mascarados. Fotos e assinaturas entram no PDF quando são PNG ou JPEG; WebP fica de fora.
- Cada aprovador recebe um **e-mail** com o **link pessoal** ("Ver relatório"). O PDF vai **anexo até 8 MB**; acima disso, o e-mail leva só o link, e o PDF é baixado pela página.
- O status passa a **Enviado** e os links da versão anterior deixam de valer.
- **Todo e-mail fica registrado no banco** e aparece em Administração → Caixa de saída (os 300 mais recentes). O envio real é pelo SMTP da SIDIM e só liga com `EMAIL_REAL` e `SMTP_HOST`; enquanto `EMAIL_REDIRECIONAR_PARA` estiver definida, todo e-mail vai para esse endereço (trava de teste). Uma falha de envio nunca desfaz a emissão: aparece como "Falhou" na Caixa de saída.

### Aprovação pelo cliente

- Há **um link por aprovador e por versão**, sem login.
- **Basta a decisão de um aprovador** e vale a primeira (a situação é conferida no próprio `UPDATE`, então dois aprovadores ao mesmo tempo não decidem os dois): os links dos demais aprovadores daquela versão param de aceitar decisão, e eles recebem um e-mail avisando quem decidiu.
- **Aprovar** → status **Aprovado**; as visitas ficam travadas.
- **Pedir ajuste** → motivo obrigatório (de 10 a 2.000 caracteres) → status **Ajuste solicitado**. A Administração corrige as visitas, atualiza a lista se precisar e emite a próxima versão.
- A partir da v2, a página do aprovador mostra **o que mudou** em relação à versão anterior.
- Um link já decidido ou de versão substituída continua abrindo **só para consulta**.
- Pelo link, o aprovador só baixa os arquivos que fazem parte da versão daquele link (PDF, fotos e assinaturas).
- A Administração não recebe e-mail: acompanha pelo status no sistema.

> Uma visita de relatório **Enviado** ainda pode ser corrigida pela Administração, mas a versão enviada não muda. A correção só aparece na próxima versão, que só pode ser emitida depois de um pedido de ajuste.

### Chamados de suporte (opcional, desligado por padrão)

Com `CHAMADOS_SUPORTE` ligado, o relatório mostra quantos chamados o cliente **abriu e teve fechados** no período, a partir dos atendimentos do Fortics guardados pelo n8n. A contagem é do **sistema do contrato**: o ReportS manda o "Nome no Fortics" do sistema, e o n8n filtra pelo campo `sistema`. Sistema sem "Nome no Fortics": contam todos os sistemas do cliente, e só a Administração vê o aviso. Detalhes em `docs/n8n-resumo-chamados.md`.

Onde: `src/lib/repo/relatorios.ts`, `src/lib/emissao.tsx`, `src/lib/email.ts`, `src/app/admin/relatorios/actions.ts`, `src/app/aprovacao/[token]/`.

## Datas e horas

- O sistema guarda tudo em UTC (ISO) e exibe no **horário de Brasília** (−03:00 fixo; não há horário de verão desde 2019).
- Entrada e saída registradas pelo técnico usam o relógio do servidor. Datas e horas digitadas pela Administração são lidas no horário de Brasília.

Onde: `src/lib/datas.ts`.

## Fotos e arquivos

- O celular comprime cada foto antes de enviar: lado maior de até 1.600 px e cerca de 500 KB em JPEG.
- O servidor aceita JPEG, PNG e WebP com até **1,5 MB** por arquivo. Cada envio de formulário tem limite de 4 MB.
- Fotos, assinaturas e PDFs ficam no **disco do servidor** (`ARQUIVOS_DIR`, por ano e mês, fora da pasta pública); o banco guarda tipo, tamanho e caminho. O arquivo é gravado primeiro com um nome temporário.
- Os arquivos do sistema (`/arquivos/<id>`) só abrem para quem está **logado**; o aprovador vê as fotos pelo link da versão.

Onde: `src/lib/imagem.ts`, `src/lib/repo/arquivos.ts`, `src/app/arquivos/[id]/route.ts`, `next.config.ts`.

## Ainda não implementado

- Aviso de visita aberta por WhatsApp (Fortics): existe só o campo de telefone no SINC; faltam o envio e as regras do aviso.
- Marcação de implantação e check-list (ficam para quando a função existir).
- Junção de participantes (provisório com confirmado): Fase 5 do plano da plataforma.
- Contrato e relatório quando o cliente tem dois tenants do mesmo sistema (QA-043 do SINC, decidida: pode): hoje cada contrato mostra o mesmo número de chamados do cliente naquele sistema.
- Envio real de e-mail depende das credenciais do SMTP da SIDIM e do SPF/DKIM do remetente; os chamados de suporte dependem do fluxo do n8n.
