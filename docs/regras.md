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
| `reports.contratos.gerenciar` | Contratos, tipo de comprovação, exigência de CPF e aprovadores; cadastro do cronograma de implantação |
| `reports.temas.gerenciar` | Temas das visitas e equipes com os temas mínimos |
| `reports.participantes.gerenciar` | Ver e editar participantes (CPF, CBO, setor) e criar provisórios fora de uma visita |
| `reports.participantes.revisar` | Reservada para a junção de participantes (Fase 5); ainda sem tela |
| `reports.visitas.gerenciar` | Ver todas as visitas e o cronograma de implantação; corrigir, encerrar e cancelar |
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

- Há **um contrato por sistema do cliente**. Ele tem: o **texto do contrato** (obrigatório; aparece na capa do relatório), o **nível de comprovação** da presença, se **exige CPF** dos participantes o **tipo do relatório de atendimentos do suporte** (sintético, o padrão, ou analítico; ver "Chamados de suporte") e se está **ativo** (nasce ativo; a caixa só existe na edição).
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
- **Buscar do Saúde** (cliente com o sistema Saúde, `reports.clientes.cadastrar`): traz os estabelecimentos **cadastrados no SIDIM Saúde do cliente**; tudo o que está lá vale, inclusive os de outros municípios (destinos de encaminhamento). O endereço da API vem do **diretório de servidores do Saúde**, pelo tenant do sistema do cliente (o mesmo do login do participante). A administração digita **um usuário e uma senha do Saúde** daquele cliente; o ReportS faz o login (`/api/login`), busca `/api/estabelecimentos` e **não guarda a senha nem o token**. A API não tem filtro: a lista vem inteira.
  - Para cada item **com CNES**, o ReportS consulta a **ficha pública do CNES** (DataSUS; id = código IBGE do município + CNES, ou pela busca do CNES quando o Saúde não tem o município) e traz **endereço completo, latitude e longitude** e o nome no CNES (mostrado quando difere, para ver CNES trocado no Saúde). Sem CNES, fica o logradouro e o CEP que o Saúde tiver (quase sempre vazios). Fichas guardadas por 24 horas; falha do CNES não impede a busca.
  - A tela lista todos **marcados**, com busca por nome, endereço, código ou CNES, a situação (**Novo** ou **Já importado**) e a opção **"Só os com CNES"** (os sem CNES não são importados). A busca só filtra o que aparece; importa tudo o que estiver marcado.
  - **Importar** grava pelo **código do Saúde** (único por cliente, não duplica): o novo entra com nome, endereço, CNES, latitude e longitude e o raio padrão; o já importado tem nome e CNES atualizados, o endereço só quando há um, e a **localização só quando ainda não tem** (a ajustada à mão não muda). Raio e setores do ReportS não mudam. O CNES aparece no cartão do estabelecimento.

Onde: `src/app/admin/clientes/actions.ts`, `src/app/admin/clientes/geo-actions.ts`, `src/app/admin/clientes/saude-actions.ts`, `src/lib/repo/clientes.ts`, `src/lib/saude-estabelecimentos.ts`, `src/lib/cnes.ts`.

### Temas

- Um tema é a combinação **nome + sistema + módulo**, todos obrigatórios, e a combinação não pode se repetir. O sistema é um dos cadastrados na plataforma.
- Se o sistema ou o módulo digitado só difere de um já cadastrado em acento ou maiúsculas, o sistema usa a grafia já existente.
- Não há exclusão: o tema é **inativado**. Tema inativo não aparece para o técnico, mas continua nas visitas em que já estava marcado.

Onde: `src/app/admin/temas/actions.ts`, `src/lib/repo/temas.ts`.

### Equipes

- Uma equipe (médica, enfermagem, administrativa…) é um **cadastro único da SIDIM**, que vale para todos os clientes, com os seus **temas mínimos**. Quem gerencia temas gerencia equipes (`reports.temas.gerenciar`).
- O nome é obrigatório (até 80 caracteres) e não pode repetir outro, sem diferenciar acento nem maiúsculas. É preciso marcar **pelo menos um tema mínimo**, entre os temas ativos (ou os que a equipe já tinha, mesmo inativados depois).
- Os temas mínimos podem ser de **sistemas diferentes**: na visita, só os do sistema do contrato são sugeridos, e só aparecem para marcar as equipes que têm **algum tema mínimo ativo desse sistema** (mais as que já estavam marcadas). Assim uma equipe só de outro sistema não vai para o relatório por engano.
- **Ocupações (CBO)** da equipe: opcional. Lista curta das ocupações que se enquadram nela (ex.: Equipe de enfermagem com Enfermeiro, Técnico de enfermagem e Auxiliar de enfermagem), escolhidas uma a uma pela busca na [tabela CBO](#tabela-cbo); código que não está na tabela é recusado, e o limite é de 60 por equipe. Uma ocupação pode estar em mais de uma equipe. Por enquanto a ligação **só fica registrada**: a visita, a presença e o cronograma ainda não a usam.
- **Carga inicial** (migração `*_equipes_saude`, 10/11/2026): 19 equipes da saúde (Médica, Enfermagem, Administrativa, Coordenação, ACS, Saúde bucal, Farmácia, Laboratório, Reabilitação, Saúde mental, Multiprofissional (eMulti), Imagem, Urgência e emergência, Saúde da mulher, Saúde da criança, Vacinação, Arquivo (GED), Almoxarifado e Tecnologia da informação), com as ocupações de cada uma. Só cria a equipe que não existe pelo nome e só liga o CBO que está na tabela. Elas nascem **sem temas mínimos**: enquanto não tiverem um tema do sistema do contrato, **não aparecem para o técnico marcar na visita** (regra acima), então complete os temas antes de usá-las no cronograma.
- As equipes marcadas como **treinadas** na visita são as que cumprem os itens do [cronograma](#cronograma-de-implantação-reportscontratosgerenciar-leitura-com-reportsvisitasgerenciar).
- Não há exclusão: a equipe é **inativada**. Equipe inativa não aparece para o técnico, mas continua nas visitas em que já foi marcada.

Onde: `src/app/admin/equipes/actions.ts`, `src/lib/repo/equipes.ts`, `src/lib/regras-visita.ts` (`equipesDaVisita`).

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
- Escolhe, em cascata: cliente (ativo) → **sistema** (contrato ativo do cliente) → estabelecimento → tipo → **equipes**.
- **Equipes no lugar do setor** (10/11/2026): na implantação, no treinamento e no treinamento online, o técnico marca as **equipes que vão ser treinadas** (todas as **equipes ativas** do cadastro, com ou sem tema mínimo). É **obrigatório marcar ao menos uma**; só sem nenhuma equipe ativa cadastrada o check-in segue sem elas. Nos outros tipos não há equipes. São as mesmas **equipes treinadas** da visita (uma lista só), que contam para o cronograma e podem ser mudadas até o check-out. O check-in **não pede mais setor**; as visitas antigas continuam com o setor que tinham.
- **Presencial**: exige a **localização do aparelho** e a **foto do ambiente**. **Online**: exige o **print da tela da reunião** e o **link da reunião** (começando com `http://` ou `https://`).
- A hora de entrada é a **hora do servidor**, nunca a do aparelho.
- Depois do check-in, **treinamento, treinamento online e implantação** abrem pela **tela de presença** (veja [Lista de presença](#lista-de-presença)); os outros tipos abrem direto na tela da visita. Ao reabrir uma visita em andamento sem nenhuma presença, a tela inicial leva de novo à presença; com presença, à tela da visita.
- O sistema grava por **qual aparelho** o check-in foi feito (celular ou computador); aparece como "Registrado por" no detalhe, no relatório e na página do aprovador. No computador, a visita presencial mostra um aviso em tela, sem bloquear.
- **Raio do estabelecimento**: o check-in presencial grava a **distância medida** até o estabelecimento e o raio da época. Fora do raio, a Administração vê o selo "Fora do raio" e a distância; dentro, "Dentro do raio". É **só alerta, nunca bloqueia**, e o técnico, o aprovador e o PDF não veem. Só mede estabelecimentos com latitude e longitude.
- A localização é lida uma única vez, no check-in e no check-out. Não há rastreamento contínuo. O navegador só libera o GPS em `https` ou `localhost`.
- Opcional (`LOCALIZACAO_POR_CEP`): a coordenada vira **CEP e endereço**, e o CEP aparece no lugar da latitude e da longitude nas telas; a coordenada continua gravada. A falha das APIs nunca bloqueia o check-in: o CEP pendente é buscado depois, pelo timer a cada 30 minutos (até 200 por vez, 1 consulta por segundo). Com `CARIMBO_FOTO`, data, hora e CEP vão no rodapé da foto do ambiente.
- O que o técnico está digitando fica guardado no aparelho (`localStorage`) até cumprir o papel: o check-in (cliente, estabelecimento, equipes, tipo e link; a foto e a localização são pedidas de novo), o tema adicional, o cadastro de novo participante (a assinatura não é guardada) e o check-out.

Onde: `src/app/tecnico/actions.ts`, `src/components/tecnico/use-gps.ts`, `src/lib/repo/visitas.ts` (`abrirVisita`), `src/lib/regras-visita.ts`.

### Durante a visita

Só o próprio técnico altera a visita, e só enquanto ela está em andamento:

- **Temas**: marca os temas ativos **do sistema do contrato** da visita (ou os que já estavam marcados, mesmo inativados depois);
- **Equipes treinadas** (só na implantação, no treinamento e no treinamento online): já vêm marcadas as do check-in, e o técnico **acrescenta ou tira** até o check-out. Aparecem **todas as equipes ativas** (e as já marcadas, mesmo inativadas depois), num cartão próprio, separado dos temas; o tema mínimo não é exigido para a equipe aparecer. O ReportS mostra os **temas mínimos** delas que são do sistema do contrato, como sugestão; o técnico marca os que trabalhou, e os demais temas continuam em "Outros temas". Marcar a equipe não marca nenhum tema sozinho. As equipes treinadas aparecem no detalhe da visita, no relatório (PDF) e na página do aprovador;
- **Tema adicional**: texto livre de até 300 caracteres;
- **Fotos extras**: adiciona e remove;
- **Anotações** (observações, pendências e próximos passos): o técnico vai anotando **durante a visita** e o texto é salvo sozinho (logo depois de parar de digitar e ao sair do campo), com até 4.000 caracteres cada. O check-out parte dessas anotações, e dá para completá-las ali;
- **Setores atendidos** (só nas **visitas antigas**, que têm setor do check-in; nas novas, as equipes ocupam esse lugar): além do setor do check-in, o técnico pode **acrescentar outros setores até o check-out** (treinou mais gente do que previa, de outros setores). Escolhe entre os setores do estabelecimento da visita ou digita um nome ("Outro"); não repete o setor do check-in nem um já acrescentado (sem diferenciar acento e caixa), e pode retirar o que acrescentou. Os **temas continuam sendo uma lista só da visita**, valendo para todos os setores. O relatório, o PDF, a página do aprovador e o detalhe da visita listam **todos os setores**; nas visitas sem setor, mostram **as equipes** no lugar. O setor não conta para o [cronograma](#cronograma-de-implantação-reportscontratosgerenciar-leitura-com-reportsvisitasgerenciar), que usa as equipes treinadas.

Onde: `src/app/tecnico/visita/actions.ts`.

### Lista de presença

- **Quem assina é o próprio participante**, na **tela de presença** (`/tecnico/visita/<id>/presenca`): enquanto o técnico apresenta, o celular ou tablet passa de mão em mão, e cada pessoa **busca o próprio nome** (a partir de 2 letras), toca nele e **assina** (ou só confirma, se o contrato é nominal). A tela mostra **só a busca e a assinatura**: nada de ocupação, setor, CPF ou selo de estado nos resultados (a ocupação e o setor só aparecem se houver dois nomes iguais na busca, para a pessoa saber qual é o dela), **nem a lista de quem já assinou**, e **sem o menu do usuário nem a barra de navegação**. Só aparece um contador ("N presenças confirmadas"). Depois de confirmar, a tela agradece pelo primeiro nome e volta sozinha à busca (4 s). Quem busca um nome que já assinou é avisado de que não precisa assinar de novo.
- Quem **não acha o próprio nome** toca em **"Não encontrei meu nome"** e se cadastra ali mesmo (nome, ocupação, setor opcional (nas visitas antigas, já preenchido com o da visita), e CPF só se o contrato exige), depois assina. Isso cria um **participante provisório**, com as regras de [Participantes](#participantes) (nome, ocupação CBO, setor opcional, CPF só se o contrato exige, aviso de CPF repetido ou nome parecido).
- Se o contrato exige CPF e o participante escolhido ainda não tem, a própria pessoa informa o CPF na tela de presença (só ele é gravado no cadastro). CPF inválido: "CPF inválido. Confira os números.". **CPF que já é de outra pessoa do cadastro:** como a tela passa de mão em mão, o **nome do dono só aparece se for parecido com o de quem está assinando** (provavelmente a mesma pessoa, que toca em "É esta pessoa"); senão a mensagem é genérica ("Este CPF já está em outro cadastro. Confira o número ou chame o técnico.") e não revela o nome.
- A mesma pessoa não entra duas vezes na lista.
- **Login do participante no Saúde (sempre ligado).** Vale para **todos os clientes do Saúde que estiverem no diretório de servidores do Saúde**, sem configuração. O ReportS pega o tenant do sistema do cliente da visita (ex.: `saude_parademinas`) e procura no diretório o servidor cuja logo está na pasta de mesmo nome (a pasta antes de `/Imagens/`, em qualquer host); o `endereco` desse servidor é o da API, chamado sempre em `https://` (o `http://` do diretório vira `https://`). Cliente que não está no diretório, sem logo ou com a mesma logo em mais de um servidor fica **sem o login**. A lista é guardada por 10 minutos; se o diretório falhar, vale a última lista boa. Com o login valendo, a sequência passa a ser **busca do nome → login → assinatura → confirmar**. A pessoa entra com o **usuário e a senha dela no Saúde**; o ReportS repassa à API (`POST /api/login`) e confere se o `userId` devolvido é o **id do Saúde do participante escolhido** (`external_user_id`): login de outra pessoa é recusado. A **senha só passa pela memória** (não é gravada, registrada em log nem devolvida ao navegador). O servidor devolve uma **prova assinada, válida por 10 minutos**, para aquele participante naquela visita, e a presença **só é gravada com a prova** (o navegador não decide sozinho que o login passou); a presença guarda como foi validada: `login_saude` ou `sem_login`.
  - **Quem não consegue entrar não assina por conta própria**: participante cadastrado sem id do Saúde (provisório), "Não encontrei meu nome", senha errada demais ou API fora do ar → a tela manda **chamar o técnico**, que usa o atalho **"Registrar sem login (técnico)"** na tela da visita (link com token assinado, válido por 30 minutos). As presenças desse modo ficam marcadas **"sem login"** na lista do técnico e no detalhe da Administração.
  - **Limite de tentativas:** 5 falhas (senha errada ou login de outra pessoa) do mesmo participante na visita, em 10 minutos, bloqueiam novas tentativas dele; 30 falhas na visita bloqueiam todas. API fora do ar não conta como falha. A contagem fica na memória do processo (reiniciar zera).
  - **Só liga com `https://` em produção** (a senha viaja até a API): com `http://` em produção o login fica desligado e o aviso vai para o log do servidor. Fora de produção, `http://` é aceito para testar. Só vale para o sistema **Saúde** (os outros sistemas do ReportS não têm essa API).
  - Onde: `src/lib/saude-login.ts`, `src/lib/repo/presenca-login.ts`, `entrarNoSaude` e `registrarPresenca` em `src/app/tecnico/visita/participantes-actions.ts`.
- Esta tela **não guarda nada no aparelho** (nem rascunho de cadastro): quem vem depois não vê o que o anterior digitou.
- Quando todos assinaram, o **técnico** toca em "Todos assinaram? Continuar" (pede uma confirmação, para ninguém tocar sem querer) e vai à **tela da visita**: temas e equipes, anotações, fotos extras, a lista de presença completa (com as assinaturas, onde o técnico pode retirar alguém lançado por engano), os setores atendidos e o check-out. Chegou mais gente? Há um botão para **voltar à tela de presença**. Em treinamento, o "Continuar" só libera depois da primeira presença.
- **Assinatura** é exigida quando o contrato é **Assinada** e a visita é **presencial**. Treinamento online é sempre nominal.
- A presença guarda uma **cópia** dos dados da pessoa naquele momento (nome, CBO, setor e CPF). Mudanças posteriores no cadastro não alteram visitas já registradas.

Onde: `src/app/tecnico/visita/participantes-actions.ts`, `src/app/tecnico/visita/[id]/presenca/`.

### Check-out

- Treinamento e treinamento online: exigem **pelo menos um participante** na lista.
- Presencial: exige a **localização do aparelho**.
- Observações, pendências e próximos passos são opcionais, com até 4.000 caracteres cada, e já vêm preenchidos com o que o técnico anotou durante a visita.
- O resumo do check-out lista todos os setores da visita (nas antigas) ou as equipes.
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

- Campos que podem ser corrigidos: entrada, saída (depois da entrada e não no futuro), tipo, estabelecimento (do mesmo cliente), setor (opcional: "Sem setor" é aceito, e as visitas novas não têm), equipes treinadas (as mesmas que o técnico pode marcar; veja [Durante a visita](#durante-a-visita)), temas (só do sistema do contrato da visita; os já marcados continuam aceitos), tema adicional, observações, pendências e próximos passos. Também dá para **retirar** participantes da lista e fotos extras.
- Os **setores acrescentados** pelo técnico não são editados na correção, mas **saem junto se a correção muda o estabelecimento** (eles são do estabelecimento anterior), e o histórico registra quais saíram.
- Equipes treinadas só existem na implantação, no treinamento e no treinamento online: se a correção muda o tipo para outro, as equipes saem da visita (a tela avisa antes de salvar).
- Cliente, técnico, sistema, localizações, foto do ambiente e print não mudam.
- O **motivo** é obrigatório (pelo menos 5 caracteres). Se nada mudou, nada é gravado.
- Visita em **relatório aprovado** fica **travada**: ninguém altera.

### Lançamento retroativo (visita que já aconteceu)

Administração → Visitas → **Lançar visita retroativa** registra uma visita que aconteceu antes (cliente que ainda não usava o ReportS, técnico sem internet, check-in esquecido). Mesma permissão da correção (`reports.visitas.gerenciar`).

- É uma visita como as outras (cliente e sistema, estabelecimento, técnico, tipo, equipes treinadas, temas, anotações, participantes, fotos), **menos o que depende de estar no local na hora**:
  - **data e horas de entrada e saída digitadas** (horário de Brasília; a saída depois da entrada e não no futuro), em vez da hora do servidor;
  - **sem GPS** de check-in e check-out, sem raio nem distância do estabelecimento;
  - **foto opcional** (ex.: fotos do dia; até 10 imagens, somando com a lista de presença), sem foto do ambiente obrigatória;
  - **presença sem assinatura e sem login do participante**: os participantes são marcados do cadastro do sistema do cliente (confirmação **nominal**) **e/ou** a presença é comprovada pela **foto da lista de presença em papel**. A foto da lista fica junto das fotos da visita, marcada como "Lista de presença"; sem nomes marcados, o detalhe e o PDF dizem "Presença registrada pela foto da lista".
- Valem as regras da visita normal: técnico com `reports.tecnico`; estabelecimento do cliente; equipes (implantação e treinamentos) **obrigatórias** quando há equipe ativa; treinamento com **ao menos um participante marcado ou uma foto da lista de presença**; só temas ativos do sistema do contrato. O técnico **não pode ter outra visita (não cancelada) que cruze o horário**.
- Entra **já encerrada**. Conta para o **cronograma** como qualquer visita encerrada. Entra no relatório do período quando ele é criado; se o rascunho já existe, o **"Atualizar"** do relatório a inclui.
- Fica marcada: selo **"Lançamento retroativo"** nas telas da Administração e "Registrado por: **Administração (lançamento retroativo)**" no detalhe da visita e no PDF do relatório. O **motivo** é obrigatório e fica no histórico, com quem lançou.
- Depois de lançada, corrige-se como qualquer visita encerrada.

### Histórico de alterações

Toda ação da Administração numa visita (encerramento, cancelamento, correção ou lançamento retroativo) fica registrada com autor, data e hora, motivo e cada campo alterado (antes → depois).

Onde: `src/app/admin/visitas/actions.ts`, `src/lib/repo/visitas.ts`, `src/components/visita/detalhe-visita.tsx`.

## Relatórios (`reports.relatorios.gerenciar`)

### Status

| Status | Exibido como | Significado |
|---|---|---|
| `rascunho` | Rascunho | criado, ainda não emitido |
| `emitido` | Emitido | versão gerada (PDF pronto), **ainda não enviada** por e-mail |
| `enviado` | Enviado | a última versão foi enviada por e-mail, aguardando a decisão do cliente |
| `ajuste_solicitado` | Ajuste solicitado | o aprovador pediu correção; a Administração emite nova versão e envia |
| `aprovado` | **Aprovado** | aprovado; relatório e visitas travados |

### Rascunho

- Um relatório é de um **contrato** (cliente + sistema) e de um período (data inicial e final, inclusive, no horário de Brasília), em geral um mês.
- O período **não pode cruzar** o de outro relatório do mesmo contrato.
- Entram as visitas **encerradas do contrato** com entrada até o fim do período e que **não estão em outro relatório**. Isso inclui visitas de períodos anteriores que ficaram de fora, marcadas como **"Período anterior"**.
- **Período sem visitas é permitido** (cliente que passou o mês sem visita): o rascunho é criado vazio e **o relatório é emitido** com os chamados de suporte e o cronograma. A emissão sem visitas só é barrada se não deu para consultar os chamados (n8n fora do ar ou conexão não configurada): o botão fica desabilitado e a tela diz o motivo. Sem visitas, o PDF não mostra horas nem a tabela de visitas; o e-mail diz “Nenhuma visita registrada no período”.
- As visitas ficam **reservadas** para o relatório e não entram em outro (duas criações ao mesmo tempo não disputam a mesma visita).
- **Atualizar visitas e chamados** recalcula a lista de visitas (ex.: uma visita esquecida foi encerrada depois) e busca os chamados de suporte de novo no n8n (o rascunho guarda o resultado por 10 minutos; a **emissão** sempre busca de novo, para congelar o número de agora). Vale para rascunho e ajuste solicitado.
- **Excluir** só vale para rascunho nunca emitido e libera as visitas.
- O relatório soma as **horas presenciais** e as **horas online** separadamente (saída − entrada de cada visita).

### Emissão, prévia e envio

**Emitir** e **enviar por e-mail** são ações separadas.

- **Emitir** gera o PDF e registra uma **versão** (v1, v2, …) com o conteúdo **congelado**: o PDF e a página do aprovador mostram exatamente o que foi emitido. **Não envia e-mail.** O status passa a **Emitido**. Não exige aprovador nem CNPJ (CNPJ pendente sai como "—" no PDF). Exige visitas **ou** chamados no período (ver "Período sem visitas"). Os chamados e o cronograma são buscados de novo na emissão.
- **Nova versão a qualquer momento:** enquanto o relatório não é aprovado, dá para **Atualizar** (visitas e chamados, de novo) e **Emitir** a versão seguinte (v2, v3…), tenha ou não sido enviada. A tela mostra os dados de agora e "o que mudou desde a última versão"; as versões antigas ficam no histórico, com o PDF de cada uma. Emitir uma versão nova invalida os links de aprovação da anterior. Depois da **aprovação** o relatório e as visitas ficam travados.
- **Baixar prévia:** um PDF dos dados de agora, marcado "PRÉVIA" na capa e no nome do arquivo, **sem registrar versão** e sem enviar nada.
- **Enviar por e-mail** (só com uma versão emitida): manda a **última versão** a cada aprovador ativo do contrato, com o **link pessoal** ("Ver relatório"). O PDF vai **anexo até 8 MB**; acima disso, só o link. O status passa a **Enviado**. **Reenviar** manda de novo e **mantém os links que ainda valem**. Sem aprovador ativo no contrato, o envio fica desabilitado: baixe o PDF e envie por fora.
- **Nome do PDF** (download, anexo do e-mail e título do documento): `Relatório Analítico - Cliente - Sistema - 01-10-2026 a 31-10-2026 - v1.pdf` (tipo do relatório de atendimentos, cliente, sistema, período de vigência e versão; a prévia leva "PRÉVIA - " na frente). O assunto do e-mail é o mesmo nome.
- O **PDF** traz os CPFs mascarados. Fotos e assinaturas entram no PDF quando são PNG ou JPEG; WebP fica de fora.
- **Todo e-mail fica registrado no banco** e aparece em Administração → Caixa de saída (os 300 mais recentes). O envio real é pelo SMTP da SIDIM e só liga com `EMAIL_REAL` e `SMTP_HOST`; enquanto `EMAIL_REDIRECIONAR_PARA` estiver definida, todo e-mail vai para esse endereço (trava de teste).
- **Contrato sem aprovador é permitido:** o aprovador é opcional no cadastro do contrato; só o envio por e-mail precisa dele.

### Aprovação pelo cliente

- Há **um link por aprovador e por versão**, sem login.
- **Basta a decisão de um aprovador** e vale a primeira (a situação é conferida no próprio `UPDATE`, então dois aprovadores ao mesmo tempo não decidem os dois): os links dos demais aprovadores daquela versão param de aceitar decisão, e eles recebem um e-mail avisando quem decidiu.
- **Aprovar** → status **Aprovado**; as visitas ficam travadas.
- **Pedir ajuste** → motivo obrigatório (de 10 a 2.000 caracteres) → status **Ajuste solicitado**. A Administração corrige as visitas, usa **Atualizar** se precisar, emite a próxima versão e a envia.
- A partir da v2, a página do aprovador mostra **o que mudou** em relação à versão anterior.
- Um link já decidido ou de versão substituída continua abrindo **só para consulta**.
- Pelo link, o aprovador só baixa os arquivos que fazem parte da versão daquele link (PDF, fotos e assinaturas).
- A Administração não recebe e-mail: acompanha pelo status no sistema.

> Uma visita de relatório **Enviado** ainda pode ser corrigida pela Administração, mas a versão enviada não muda. A correção só aparece na próxima versão, que só pode ser emitida depois de um pedido de ajuste.

### Chamados de suporte (sempre ativos)

Todo relatório mostra os **atendimentos do suporte** do cliente no período, a partir dos atendimentos do Fortics guardados pelo n8n. A contagem é do **sistema do contrato**: o ReportS manda o "Nome no Fortics" do sistema, e o n8n filtra pelo campo `sistema`. Os atendimentos do cliente são buscados pelo **nome dele no SINC** (do cadastro) e pelos "Outros nomes nos atendimentos", se a Administração os cadastrou para quando o Fortics grava o cliente de outra forma. Sistema sem "Nome no Fortics": contam todos os sistemas do cliente, e só a Administração vê o aviso. A conexão com o n8n (só o endereço do webhook, sem chave) se configura em **Administração → Configurações** (permissão de relatórios), guardada no banco; sem a conexão, o bloco some do relatório do cliente e a Administração vê o aviso. Detalhes em `docs/n8n-resumo-chamados.md`.

- **Painel (igual nos dois tipos de relatório):** quatro indicadores (**atendimentos**, **espera média**, **atendimento médio** e **tempo total dedicado**) e a contagem **por tabulação** (o motivo de encerramento), com barra proporcional, quantidade, porcentagem e uma linha fina entre as linhas. O "por assunto" saiu: o assunto é texto livre e quase não se repete; ele aparece em cada linha da lista analítica. O atendimento médio e o tempo total saem da lista (tempo dedicado de cada atendimento: o TMA do n8n; atendimento sem TMA mostra "—" e fica fora das duas contas). Relatórios emitidos antes de 06/11/2026 não mudam: neles o tempo é o encerramento menos a abertura.
- **Tipo do relatório, por contrato** (Administração → Clientes → contrato → "Relatório de atendimentos do suporte"): **Sintético** (padrão, e como ficam os contratos que já existiam) = só o painel. **Analítico** = o painel e, no **PDF**, a **lista de todos os atendimentos** do período, do mais antigo ao mais recente, em páginas próprias depois da capa: data e horário (início e fim), tempo, **solicitante** (o usuário do cliente), **técnico** que atendeu, assunto e tabulação. **Sem o número de protocolo.** O tipo vale no momento da emissão e fica congelado na versão.
- **Quem vê o quê:** o PDF traz o painel (e a lista, no analítico); a página do aprovador mostra só o painel, sem nomes; a Administração vê o painel e a lista completa no rascunho ("Ver os N atendimentos"), com um selo do tipo do contrato.
- **Campos que o Fortics não trouxer** (solicitante, tempo) saem como "—" na lista, e o painel usa só os atendimentos que têm o dado.

Onde: `src/lib/repo/relatorios.ts`, `src/lib/emissao.tsx`, `src/lib/email.ts`, `src/app/admin/relatorios/actions.ts`, `src/app/aprovacao/[token]/`.

## Cronograma de implantação (`reports.contratos.gerenciar`; leitura com `reports.visitas.gerenciar`)

Planeja **onde, para quem e até quando** cada atividade deve acontecer. Exemplo: "no Posto Central, a Equipe de enfermagem recebe o treinamento até 20/11". Fica em Administração → Cronograma.

- Um **item** é de um **contrato** (cliente + sistema) e traz: **estabelecimento**, **equipes** (uma ou mais, do [cadastro de Equipes](#equipes); nenhuma = todas as equipes), **atividade** (um dos tipos de visita, como Treinamento ou Implantação), **prazo** (data, vale até o fim do dia, no horário de Brasília), um **horário** opcional e uma **observação interna**.
- O **horário** é texto livre ("09:30 e 14h", "Dia todo", até 60 caracteres) e só informa: aparece na lista do Cronograma, embaixo do prazo, e na importação. **Não conta** para item repetido nem para o cumprimento, e não vai para o técnico nem para o relatório do cliente. Duas sessões no mesmo dia, para o mesmo estabelecimento e equipes, são **um item** com os dois horários.
- Só o contrato **ativo** de cliente ativo recebe item novo. O contrato de um item não muda: para outro contrato, cancele e crie outro. Não pode haver dois itens ativos iguais (mesmo contrato, estabelecimento, atividade, prazo e as mesmas equipes, em qualquer ordem); com prazos diferentes são itens diferentes (o cronograma pode ter um item por dia). Dá para marcar as equipes ativas; as que o item já tinha continuam aceitas mesmo inativadas depois.
- A **situação nunca é digitada**: o sistema calcula pelas **visitas encerradas** do mesmo contrato, estabelecimento e tipo que marcaram **todas as equipes do item** como "equipes treinadas" (a visita pode ter treinado outras também). Item sem equipe: qualquer visita do tipo no estabelecimento cumpre. O **setor da visita não conta**. Visita em andamento ou cancelada não conta. **Itens iguais em dias diferentes** (mesmo contrato, estabelecimento, atividade e equipes) não dividem visita: cada visita cumpre **um** deles, o de prazo mais cedo ainda em aberto (as visitas são usadas da mais antiga para a mais nova). Ex.: 4 dias de treinamento da equipe médica no AME precisam de 4 visitas. Itens com equipes diferentes podem ser cumpridos pela mesma visita. Para cada item, vale a visita que coube a ele:
  - **Cumprido**: a visita foi até o prazo. **Cumprido com atraso**: foi depois.
  - Sem visita: **Atrasado** se o prazo passou; **A vencer** se faltam até 7 dias (inclusive no próprio dia do prazo); **No prazo** nos demais casos.
  - **Cancelado**: a Administração cancelou; não conta e não aparece ao técnico nem ao cliente. Dá para reativar.
- **Administração:** a lista vem do item mais urgente ao menos urgente, com quatro contadores (atrasados, a vencer, no prazo, cumpridos) e filtros por contrato e situação. Criar, editar e cancelar exigem `reports.contratos.gerenciar`; quem só tem `reports.visitas.gerenciar` vê, sem editar.
- **App do Técnico:** no check-in, ao escolher o estabelecimento, o técnico vê o que **ainda falta** ali (atrasado, a vencer e no prazo), com as equipes de cada item. Não vê a observação interna.
- **Relatório:** o relatório do contrato traz o cronograma dele (sem os cancelados e **sem a observação interna**). **O cliente nunca lê "atraso"**: no relatório, no PDF e na página do aprovador, "Cumprido com atraso" aparece como **Cumprido** (com a data em que foi cumprido embaixo) e "Atrasado" aparece como **Pendente**, e o resumo diz só "N de M itens cumpridos". A Administração e o técnico seguem vendo a situação exata. A troca é feita na hora de mostrar, então vale também para os relatórios já emitidos. Sobre o cronograma no relatório: no rascunho, na situação de hoje; na **emissão**, **congelado** junto com a versão, como os chamados. A página do aprovador e o PDF mostram o mesmo, e uma mudança no cronograma depois da emissão não altera a versão enviada. Relatório de contrato sem cronograma não mostra o bloco, e versões emitidas antes desta função continuam sem ele. A coluna é **Equipes**; nas versões emitidas antes das equipes no cronograma, ela mostra o setor que o item tinha ("Setor Recepção").
- **Remover** um estabelecimento com **item ativo** no cronograma é barrado; os itens já cancelados saem junto.
- **O cronograma não usa mais setor** (10/11/2026). Os itens criados antes guardam o setor só como registro (coluna `setor_id`, não é mais lida nem mostrada); remover esse setor do estabelecimento não é barrado, e o item só perde a referência. Desde a mesma data, o check-in também não pede setor: pede as equipes (veja [Check-in](#check-in)).

### Importação por planilha (`reports.contratos.gerenciar`)

Cronograma → **Importar planilha** cadastra vários itens de uma vez a partir de um arquivo do Excel. A conferência é **um item por vez, em etapas**, e nada é gravado antes de você confirmar no resumo final.

- **Arquivo:** `.xlsx`, até 2 MB e 500 linhas, só a **primeira aba** é lida. Há um **modelo para baixar** na própria tela. A primeira linha é o cabeçalho; as colunas podem estar em qualquer ordem, sem diferenciar acento nem maiúsculas: **Cliente**, **Sistema**, **Estabelecimento**, **Equipe** (opcional; também aceita "Equipes" ou "Categoria profissional"; várias separadas por vírgula ou ponto e vírgula; em branco vale todas as equipes), **Atividade**, **Prazo**, **Horário** (opcional; também aceita "Hora"; a hora digitada como hora no Excel vira "09:30") e **Observação** (opcional). Colunas que não são essas, como "Setor", são **ignoradas com aviso**: o cronograma usa as equipes.
- **Prazo:** data do Excel, número de série ou texto (`20/11/2026`, `20-11-26`, `2026-11-20`). **Atividade:** o nome ou o código do tipo de visita (Treinamento, Implantação, Treinamento online…).
- **Como cada linha é reconhecida:** o contrato é o **ativo** do cliente para o sistema (pelo nome do cliente e pelo nome ou código do sistema); o estabelecimento, **pelo nome** dentro desse cliente; as equipes, pelo nome no cadastro de Equipes (só as ativas). Se houver dois contratos do mesmo cliente e sistema (dois tenants), a tela pede para escolher.
- **Só aparece o que precisa de você:** depois de analisar o arquivo, a tela abre no **item 1 de N**, em que N é o número de linhas com pergunta ou erro. As linhas que já estão certas **entram sozinhas** e só aparecem no **resumo final** (em "Ver todas as linhas da planilha"). Uma linha de cabeçalho da tela mostra o progresso ("Item 3 de 9") e **pontos** coloridos, um por item (amarelo: falta responder; vermelho: erro; verde: resolvido; cinza: pulado ou ignorado), que também servem para ir direto a um item.
- **Os campos aparecem em etapas:** cada item mostra o que veio na planilha e, abaixo, os campos **na ordem contrato → estabelecimento → equipes → atividade → prazo**: os já resolvidos e o primeiro que falta. Os seguintes **só aparecem quando o atual é resolvido** (a regra está em `etapasDaLinha`, `src/lib/importar-cronograma.ts`). Mudar uma resposta anterior faz os campos seguintes voltarem a depender dela.
- **O que não existe vira pergunta:** estabelecimento que não está no cadastro aparece no item, e você escolhe **cadastrar como novo** ou **alterar para um existente** (com sugestão do mais parecido). A escolha vale para **todas as linhas que usam o nome** (a tela diz "vale também para a linha 5"): o item que a mesma resposta já resolveu é **pulado pelo "Próximo"**, e dá para revê-lo com "Anterior". A resposta **pode ser mudada até confirmar**. Estabelecimento novo nasce **só com o nome** (raio de 50 m, sem endereço nem coordenadas): complete depois em Clientes. **Equipe que não existe não é cadastrada pela importação**: o item mostra quais nomes não bateram e você marca as equipes ali (nenhuma marcada = todas), ou cadastra a equipe em Equipes e envia a planilha de novo.
- **Erros na própria tela:** cliente ou contrato que não bate se resolve **escolhendo um contrato**; equipes que não existem, atividade e prazo inválidos são **corrigidos ali**, um de cada vez. Estabelecimento em branco ou grande demais, e observação com mais de 500 caracteres **não têm conserto na tela**: a tela avisa que isso se corrige na planilha, e só dá para **pular** o item. **"Pular este item"** vale para qualquer item (e "Importar este item" desfaz).
- **"Próximo" só libera com o item resolvido** (certo, pulado ou ignorado por já existir), para a pessoa não deixar pergunta para trás. Depois do último item pendente vem o **resumo**; a lista de itens não muda enquanto se responde (um item resolvido por outra resposta continua na lista, como verde).
- **Duplicados:** item que já existe (ativo) e linha repetida na planilha ficam de fora ("Ignorada"), então **reimportar a mesma planilha não duplica**.
- **Resumo e confirmar:** o resumo mostra quatro contadores (serão criadas, falta resolver, já existem ou se repetem, puladas) e o que vai acontecer (itens e estabelecimentos novos). **Confirmar importação** só libera quando nada falta resolver e há algo a criar; se faltar, o resumo tem um botão que leva ao primeiro item pendente. Planilha **sem nenhuma pendência** abre direto no resumo. O servidor **confere tudo de novo** antes de gravar e é **tudo ou nada**: se algo estiver errado, nada é gravado. Estabelecimentos, itens e as equipes dos itens entram numa só transação.
- **Permissões:** importar exige `reports.contratos.gerenciar`. **Cadastrar** estabelecimento novo exige também `reports.clientes.cadastrar`; sem ela, o botão "Cadastrar" fica travado e só vale alterar para um existente.

Limites desta versão: visita **antes** da criação do item também o cumpre; cada visita pode cumprir vários itens (dois itens iguais com datas diferentes não são aceitos); as equipes treinadas são marcadas pelo técnico (o CBO de quem assinou ainda não as preenche); o treinamento online é um tipo à parte do presencial; não há aviso automático de prazo vencendo (a lista e os contadores são a forma de acompanhar).

Onde: `src/lib/cronograma.ts` (regras), `src/lib/repo/cronograma.ts`, `src/lib/importar-cronograma.ts` e `src/lib/repo/importar-cronograma.ts` (importação), `src/app/admin/cronograma/importar/` (a revisão em etapas é `revisao-etapas.tsx`), `src/app/admin/cronograma/`, `src/components/cronograma/`, `src/app/tecnico/page.tsx`, `src/lib/emissao.tsx`. Migrações: `prisma/reports/migrations/*_cronograma` e `*_cronograma_equipes`.

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
- Temas mínimos por pessoa: a visita não mostra quem já recebeu cada tema, e o participante não tem equipe. Um relatório de temas mínimos ainda não treinados, por cliente e equipe, está em análise.
- Contrato e relatório quando o cliente tem dois tenants do mesmo sistema (QA-043 do SINC, decidida: pode): hoje cada contrato mostra o mesmo número de chamados do cliente naquele sistema.
- Envio real de e-mail depende das credenciais do SMTP da SIDIM e do SPF/DKIM do remetente; os chamados de suporte dependem do fluxo do n8n.
