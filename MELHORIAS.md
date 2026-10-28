# Melhorias e sugestões — SIDIM Visitas

Registro de alterações futuras e sugestões. O `README.md` continua sendo a referência de como rodar o sistema e da situação atual; aqui fica o que ainda **vamos fazer** ou **queremos avaliar**.

## Como usar

- Um item por linha: `- [ ]` pendente, `- [x]` feito.
- Informe a prioridade (**Alta**, **Média** ou **Baixa**) e, quando souber, a origem da sugestão.
- Ao concluir, marque o item e mova para **Concluído** com a data e o commit.
- Decisões que mudam regra de negócio devem ser anotadas no próprio item, para não se perderem.

## Definições da próxima versão

Registradas em 26/10/2026. Legenda: ✅ definido · ⚠ ponto de atenção · *Evolutiva* = entra numa versão seguinte · *Fora desta versão* = só entra quando a função existir. Onde aparece **Hoje no código**, é o que foi conferido no repositório no momento do registro.

**Situação em 28/10/2026:** feitos **1, 2, 3, 5, 6, 10, 11 e 12** (o 2 só para o participante; o 5 é o botão de busca de coordenadas, desligado por padrão e testado com o serviço real em 28/10/2026) · parcial **9** (campo de telefone feito; falta o envio) · sem código por definição **4, 7 e 8**. Além dos pontos, entraram na `main` as duas entregas externas (**chamados de suporte** e **localização por CEP**): ver "Entregas externas integradas", mais abaixo. Os motivos, as evidências e o que destrava cada um estão em **"Pontos bloqueados e decisões em aberto"**, mais abaixo.

- **1. Sistema da operação, não de uma pessoa.** O sistema tem três papéis — Gestor, Técnico e Aprovador — e qualquer pessoa pode ocupar qualquer um deles. Pode existir mais de um gestor, e a coordenação pode mudar de mão sem que nada quebre: nenhum cadastro, relatório ou fluxo tem nome de pessoa escrito dentro. O mesmo vale para o que é configurável (clientes, estabelecimentos, setores, temas): fica em cadastro, não no código. **Auditado e ajustado em 27/10/2026 (`c4c4c81`).**
   - **Nomes de pessoa:** só aparecem nos dados de exemplo (`src/lib/repo/*`), que o banco real substitui. O único nome fora disso, um exemplo no campo de ajuste da página do aprovador, virou texto genérico.
   - **Vários gestores:** o cadastro de usuários já permite. O gestor não consegue inativar a própria conta nem mudar o próprio perfil, então sempre sobra um gestor ativo. O histórico guarda o nome de quem agiu e as visitas antigas continuam mostrando técnicos já inativos, então trocar de pessoa não apaga nada.
   - **Corrigido:** mudar o papel de alguém (ou inativá-lo) enquanto ele estava logado fazia o navegador entrar num laço de redirecionamentos, com tela em branco (37 redirecionamentos em 5 segundos). Agora a pessoa cai no login e entra de novo na área certa. Testado nos três casos: técnico promovido, gestor rebaixado e conta inativada.
   - **Decidido em 27/10/2026: manter fixos** os tipos de visita (`TIPOS_VISITA` em `src/lib/visitas.ts`), por ora. Não estavam na lista do que precisa ser configurável. Se virarem cadastro, como temas e setores, é um ponto novo.
- ✅ **2. Cargo sai, fica só o CBO** (Classificação Brasileira de Ocupações). **Feito para o participante em 26/10/2026 (`63d3dd4`).**
   - Removido de `Participante` e `PresencaVisita`, do cadastro e da edição na Administração, do cadastro em campo e da lista no App do Técnico, do detalhe e da correção de visita e da tabela do PDF do relatório. A busca de participantes passa a ser por nome, ocupação ou setor.
   - **Decidido em 27/10/2026: manter** o cargo do **aprovador** (`Aprovador` e `aprovadorCargo` em `src/lib/types.ts`, cadastro do cliente e relatório). Ele não tem CBO que o substitua, e remover apagaria um dado cadastrado sem ganho. Se um dia o relatório precisar dizer quem aprovou em nome do cliente, o cargo ajuda.
- ✅ **3. Setor do participante: opcional,** já preenchido com o setor da visita. **Feito em 27/10/2026 (`226ac59`).**
   - No cadastro de novo participante em campo (App do Técnico), o campo já vem com o setor da visita e pode ser apagado. Na Administração, o setor deixou de ser obrigatório. Sem setor, as tabelas e o PDF mostram "—".
   - **Decidido em 27/10/2026 (`7cb5a6d`):** participante já cadastrado, escolhido pela busca, mantém o setor do próprio cadastro; se esse setor estiver vazio, a presença herda o setor da visita. Só a presença recebe o setor; o cadastro do participante não muda. O cartão do participante escolhido mostra "(setor da visita)" nesse caso.
- **4. Lista de presença por seleção: evolutiva.** Nesta versão o técnico digita os participantes. Quando a base de pessoas do cliente estiver disponível, passa a ser seleção. **É o primeiro item a alinhar com o time de desenvolvimento.**
- **5. Coordenadas do estabelecimento sem digitação, com solução gratuita.** Converter endereço em coordenadas por serviço aberto. Isso acerta a rua, não a porta — então o ponto fica ajustável, e a posição do primeiro check-in pode refinar a referência do estabelecimento.
   - **Hoje no código:** latitude e longitude do estabelecimento são digitadas à mão (`Unidade` em `src/lib/types.ts`).
   - **Não iniciado (27/10/2026):** o ambiente de desenvolvimento em nuvem bloqueia o serviço aberto de endereços (`nominatim.openstreetmap.org`, política de rede), então não dá para testar a chamada real daqui. Para fazer: liberar esse domínio nas configurações de rede do ambiente, ou desenvolver e testar no computador local. Sem esse ponto, o raio da definição 6 só funciona nos estabelecimentos com coordenadas digitadas.
- ⚠ **6. Raio do estabelecimento: alerta, não bloqueio.** **Feito em 27/10/2026 (`d50565c`).** O raio de 300 m foi questionado, mas 20–30 m é apertado demais: o GPS (Sistema de Posicionamento Global) do celular erra de 5 a 20 metros em rua aberta e bem mais dentro de prédio, e UPA e hospital são justamente onde o sinal é pior. Com 25 m, o técnico que está lá dentro geraria alerta quase sempre, e alerta que toca sempre ninguém olha.
   - **Sugestão:** começar em 50 m e gravar a distância medida em cada check-in. Em dois meses o número real permite apertar o raio com dado, não com palpite. O raio é por estabelecimento, então o que for problemático se ajusta sozinho.
   - **Feito:** cada estabelecimento tem um raio de verificação (padrão 50 m; editável em Clientes → estabelecimento, de 10 a 5000 m). O check-in presencial grava a distância medida até o estabelecimento e o raio da época, para o alerta não mudar se o raio for alterado depois.
   - Fora do raio, a Administração mostra o selo "Fora do raio" nas listas de visitas e a distância no detalhe da visita ("178 m — fora do raio de 50 m"). Dentro do raio, mostra o selo verde "Dentro do raio" e "0 m — dentro do raio de 50 m" (acrescentado em 28/10/2026; sem medição, nenhum dos dois aparece). Nunca bloqueia o check-in. Técnico, aprovador e PDF do relatório **não** veem o alerta nem a distância.
   - **Limites e a decidir:** só mede estabelecimentos com latitude e longitude (sem elas, o detalhe mostra "Não medida"); o alerta vai só para o gestor, não para o técnico no momento do check-in (**decidido em 27/10/2026: continua assim**, para o alerta não disparar com frequência em UPA e hospital); não há ainda um painel com o histórico das distâncias para ajustar o raio (a distância de cada visita já fica gravada). A visita de exemplo de 20/10 (Visita técnica, Carlos) está fora do raio, para demonstração.
- **7 e 8. Marcação de implantação e check-list: fora desta versão.** Entram quando a função existir.
- **9. Aviso de visita aberta por WhatsApp, via Fortics.** **Parcial: o campo de telefone está feito (27/10/2026, ver abaixo); o envio não.** O número virá do cadastro do técnico. O e-mail fica como reserva. O sistema continua nunca encerrando a visita sozinho.
   - **Dúvida para o time:** o Fortics expõe API (Interface de Programação de Aplicações) para disparo? Se expuser, é o melhor canal. Notificação do próprio navegador é alternativa, mas falha no iPhone e não é confiável.
   - **Feito:** o cadastro de usuário tem o telefone com DDD, opcional, com máscara de digitação e validação (10 dígitos, ou 11 começando com 9 depois do DDD). Aparece na lista de usuários. Guardado só com dígitos, sem o 55 do país.
   - **Falta, e não dá para fazer sem o time:** o envio em si (depende da resposta sobre a API do Fortics) e as regras do aviso, que ainda não foram definidas: depois de quantas horas aberta a visita dispara, se repete, e quem mais é avisado. Hoje a Administração já destaca visitas abertas há 10 horas ou mais, sem enviar nada.
- **10. Registro pelo celular e pelo computador, com o meio identificado.** O técnico registra pelos dois, e a visita grava por onde foi feita, aparecendo no relatório. No computador, aviso em tela quando o tipo for presencial. Modo específico de treinamento online fica como *evolutiva*. **Feito em 27/10/2026 (`d50565c`).**
   - **Feito:** o check-in identifica o aparelho (celular ou computador) e grava na visita. Aparece como "Registrado por" no detalhe da visita, no relatório (tela e PDF) e na página do aprovador. No computador, visita presencial mostra um aviso em tela, sem bloquear. As mensagens de localização passam a falar em "aparelho".
   - **Limites:** a identificação é pelo navegador (tablet conta como celular); a localização de um computador é aproximada; o App do Técnico segue em coluna estreita também no computador. O modo específico de treinamento online segue como evolutiva.
- **11. Nada se perde, com rascunho local.** Cada item é salvo no servidor quando registrado, e o que está sendo digitado fica guardado no próprio aparelho — aba aberta, celular travado ou bateria no fim, o técnico volta e encontra tudo como estava. **Feito em 27/10/2026 (`cfbf5d0`).**
   - **Já era assim:** os temas marcados, as fotos extras e as presenças confirmadas são salvos no servidor na hora, e o check-out já guardava rascunho das observações, pendências e próximos passos.
   - **Novo:** rascunho do **check-in** (cliente, estabelecimento, setor, tipo e link da reunião), do **tema adicional** (recuperado e salvo no servidor ao reabrir) e do **cadastro de novo participante** (nome, ocupação, setor e CPF; a tela avisa que a recuperação aconteceu). Cada rascunho é apagado quando cumpre o papel: check-in feito, presença confirmada, "Voltar à busca" ou visita encerrada.
   - **Limites:** a foto do check-in e a localização são pedidas de novo; a assinatura do participante não é guardada (a tela avisa); o rascunho fica no navegador do aparelho, então não acompanha o técnico se ele trocar de aparelho ou limpar os dados do navegador.
- ✅ **12. "Liberado para faturar" passa a "Aprovado".** **Feito em 26/10/2026 (`805693d`).**
  - O rótulo está em `src/lib/visitas.ts` e aparece no selo de status, na lista e no detalhe do relatório (Administração).
  - **Ficou como estava, a decidir:** a mensagem ao aprovador na página de aprovação (`src/app/aprovacao/[token]/decisao.tsx`: "A aprovação libera o faturamento dos serviços…"), a frase do README ("que libera o faturamento") e o cabeçalho "Status / faturamento" da lista de relatórios. Falam do faturamento como conceito, não do rótulo.

### Para alinhar com o time de desenvolvimento

- [ ] **Primeiro** — Base de pessoas do cliente, para a lista de presença passar de digitação a seleção (definição 4).
- [ ] O Fortics expõe API para disparo de WhatsApp? E quais as regras do aviso: depois de quantas horas, se repete, quem mais recebe? (definição 9)
- [x] A remoção do cargo vale também para o aprovador? (definição 2) — **respondida em 27/10/2026: não, o cargo do aprovador fica.**
- [x] O alerta de check-in fora do raio vai só para o gestor ou o técnico também é avisado? (definição 6) — **respondida em 27/10/2026: só o gestor.**

## Pontos bloqueados e decisões em aberto

Atualizado em 27/10/2026. Aqui está tudo o que **não anda sem uma ação de fora do código**, com o motivo, a evidência, o que destrava e quem pode destravar. A ideia é resolver um por um, na ordem sugerida no fim da seção.

**Tipos de bloqueio:** *técnico* (o ambiente impede) · *informação externa* (depende do time ou de um fornecedor) · *dependência* (espera outra coisa ficar pronta) · *decisão* (falta escolher entre opções).

| Ponto | Tipo | O que destrava | Quem |
|---|---|---|---|
| **5. Coordenadas automáticas** | Técnico | Liberar `nominatim.openstreetmap.org` na rede do ambiente, ou fazer no computador local | Quem administra o ambiente |
| **9. Aviso por WhatsApp (Fortics)** | Informação externa | Resposta sobre a API do Fortics, regras do aviso e um agendador na hospedagem | Time de desenvolvimento / Fortics |
| **4. Lista de presença por seleção** | Dependência | Definir de onde vem a base de pessoas do cliente | Time de desenvolvimento |
| **7 e 8. Implantação e check-list** | Não é bloqueio: adiados por definição | Entram quando a função existir | — |
| **3 decisões em aberto (2, 6 e 7)** | Decisão | Uma resposta para cada. As decisões 1, 3, 4 e 5 foram respondidas em 27/10/2026. | Quem decide o produto |
| **Login único entre sistemas** | Dependência (nova) | Decidir antes do banco real | Quem decide a arquitetura |

### Ponto 5 — Coordenadas do estabelecimento sem digitação · feito e testado com o serviço real (28/10/2026)

- **Entregue:** botão **"Buscar coordenadas pelo endereço"** em Clientes → estabelecimento → Editar. A chamada ao Nominatim roda no servidor (`src/lib/geocodificar.ts`, mesma fila de 1 consulta por segundo da localização por CEP), latitude e longitude são preenchidas e **continuam editáveis**, a mensagem mostra o endereço que o mapa achou e há um link "Ver no mapa". Trata endereço não encontrado, serviço fora do ar e excesso de buscas (10 por minuto por gestor). **Desligado por padrão** (`BUSCA_COORDENADAS=true`). Roteiro em `docs/teste-busca-coordenadas.md`.
- **Testado** com o Nominatim simulado (14/14) e, em 28/10/2026, no computador local, com o serviço real: a busca preencheu as coordenadas de um estabelecimento. Para ligar em produção: `BUSCA_COORDENADAS=true` e um `GEOCODING_USER_AGENT` com contato real.
- **Não entregue (decisão pendente):** refinar o ponto pelo primeiro check-in. Recomendação: só sugerir ao gestor, nunca alterar sozinho.
- **Histórico do bloqueio:** o ambiente em nuvem não alcança o domínio do serviço (veja abaixo); por isso o teste real é feito no computador local.

**Contexto original do bloqueio (mantido para consulta):**

- **O que estava bloqueado:** a chamada ao serviço aberto que converte endereço em coordenadas. Sem testar a chamada real, não entregamos a função.
- **Evidência (27/10/2026):** ao chamar `https://nominatim.openstreetmap.org/search?...` a partir do ambiente de desenvolvimento em nuvem, a resposta foi `CONNECT tunnel failed, response 403`. É o proxy do ambiente recusando o domínio (política de rede), não o serviço fora do ar.
- **Confirmado em 28/10/2026:** no computador local, o Nominatim e o ViaCEP responderam normalmente (consulta inversa, coordenada → endereço, usada pela entrega do CEP). Ou seja, o bloqueio é só do ambiente em nuvem, e a saída 2 abaixo funciona.
- **Duas saídas:**
  1. **Liberar o domínio.** Nas configurações do ambiente em nuvem (menu do ambiente na barra de título da sessão → *Edit* → *Network access*), ampliar o nível de acesso ou incluir `nominatim.openstreetmap.org` em *Allowed domains*, mantendo marcada a caixa dos gerenciadores de pacotes para o `npm install` continuar funcionando. Passo a passo oficial: https://code.claude.com/docs/en/cloud-environments#network-access
  2. **Fazer no computador local**, numa sessão que roda lá, sem a restrição de rede. Depois é só enviar a branch.
- **Escopo depois de destravar (tamanho: pequeno a médio):** botão "Buscar coordenadas pelo endereço" no cadastro do estabelecimento (Clientes → estabelecimento → Editar); a chamada roda no servidor; latitude e longitude são preenchidas e **continuam editáveis**; mensagem clara quando o endereço não é encontrado ou o serviço falha; teste com endereços reais da SIDIM.
- **Decisões a tomar antes:**
  - *Qual serviço.* O Nominatim (OpenStreetMap) é gratuito, mas a instância pública tem regras de uso: identificar o aplicativo no cabeçalho da requisição, no máximo 1 consulta por segundo e uso moderado. Para volume maior, seria outro serviço ou uma instância própria.
  - *Refinar a referência pelo primeiro check-in.* A definição diz que a posição do primeiro check-in pode refinar o ponto. **Recomendação:** só sugerir ao gestor, nunca alterar sozinho. Um check-in feito no estacionamento deslocaria a referência de todas as visitas seguintes.
- **Efeito sobre outros pontos:** o raio (ponto 6) só mede estabelecimentos que têm coordenadas, e hoje elas são digitadas à mão. Nos dados de exemplo, só a "Sede da Prefeitura" tem.

### Ponto 9 — Aviso de visita aberta por WhatsApp (Fortics) · bloqueio de informação externa

- **Já pronto:** o telefone com DDD no cadastro de usuário (`9dac1a8`); o destaque "Possivelmente esquecida" para visitas abertas há 10 horas ou mais, na Administração (`HORAS_ALERTA` em `src/app/admin/visitas/page.tsx`); e a regra de que o sistema nunca encerra a visita sozinho (nenhum trecho do código faz isso).
- **O que bloqueia (cinco itens):**
  1. **API do Fortics.** Ele expõe API de disparo? Qual a documentação, a autenticação, os limites e o custo? Se for a API oficial do WhatsApp, mensagens iniciadas pela empresa costumam exigir modelos de mensagem pré-aprovados. *A confirmar com o fornecedor.*
  2. **Regras do aviso, ainda não definidas:** depois de quantas horas dispara, se repete, em que horário pode enviar, quem mais recebe (o gestor?) e o que fazer quando o técnico não tem telefone cadastrado.
  3. **Agendador.** O sistema não tem tarefas em segundo plano. Para olhar as visitas abertas de tempos em tempos, a hospedagem precisa de uma tarefa periódica, que só passa a existir quando o sistema for publicado (item de infraestrutura pendente).
  4. **E-mail de reserva.** Depende do envio real de e-mail, que ainda é simulado (item de infraestrutura pendente).
  5. **Uso do número.** Confirmar com quem cuida de LGPD e RH se o telefone do técnico pode receber mensagens da empresa. *A confirmar.*
- **O que destrava:** as respostas do time e do Fortics, as regras definidas e a publicação com agendador.
- **Enquanto isso:** não há trabalho útil no código sem risco de retrabalho.

### Ponto 4 — Lista de presença por seleção · dependência

- **Hoje:** o técnico busca por nome entre os participantes já cadastrados do cliente e, se a pessoa não existe, cadastra em campo.
- **O que falta definir:** de onde vem a base de pessoas do cliente (outro sistema interno, planilha do cliente, integração com o cliente); que dados ela traz (nome, CPF, CBO, setor); como é mantida atualizada; e como tratar os dados pessoais (LGPD, principalmente o CPF).
- **Por que é "o primeiro a alinhar":** a resposta muda o desenho de vários itens, inclusive o do login único (a base de pessoas pode morar em outro sistema).
- **Depois de definido:** a seleção passa a ser a forma principal, e a digitação livre vira exceção.

### Pontos 7 e 8 — Marcação de implantação e check-list · adiados, não bloqueados

A definição diz apenas que entram "quando a função existir". Não há escopo: o que é a marcação de implantação, e se o check-list é fixo ou por cliente, ainda não foi descrito. Nada a fazer até lá.

### Decisões em aberto (bloqueiam o acabamento de pontos já feitos)

**Situação em 27/10/2026:** respondidas as decisões **1** (manter o cargo do aprovador), **3** (alerta só para o gestor), **4** (herdar o setor da visita, feito em `7cb5a6d`) e **5** (tipos de visita continuam fixos). A **6** foi resolvida em 28/10/2026 (PR com os 12 pontos mesclada na `main`). Seguem abertas a **2** (falta o motivo da troca para "Aprovado") e a **7** (decisão do dono do repositório).

| # | Decisão | Fato verificado | Opções |
|---|---|---|---|
| 1 | **Cargo do aprovador** (ponto 2) | O cargo só aparece no cadastro do cliente. É copiado para o link de aprovação (`aprovadorCargo`), mas nenhuma tela do aprovador nem o PDF o mostram. | Remover (arquivos: tipos, cadastro do cliente, repositório de clientes e de relatórios) ou manter. O impacto é baixo nos dois sentidos. |
| 2 | **Textos de "faturamento"** (ponto 12) | Três lugares ainda falam de faturamento: a mensagem ao aprovador (`src/app/aprovacao/[token]/decisao.tsx`), o README e o cabeçalho "Status / faturamento" da lista de relatórios. | Se a ideia é o sistema não afirmar nada sobre faturamento, mudar os três (sugestão para a mensagem: "A aprovação confirma os atendimentos deste relatório."). Se foi só o rótulo, manter. |
| 3 | **Quem recebe o alerta de raio** (ponto 6) | Hoje só o gestor vê o selo e a distância. | Manter só o gestor, ou avisar também o técnico na hora do check-in. |
| 4 | **Setor da presença de participante já cadastrado** (ponto 3) | Se o cadastro da pessoa não tem setor, a presença fica sem setor. | **Recomendação:** herdar o setor da visita, coerente com a definição "já preenchido com o setor da visita". É uma mudança pequena. |
| 5 | **Tipos de visita como cadastro** (ponto 1) | São uma lista fixa em `src/lib/visitas.ts`. | Manter fixos ou virar cadastro, como temas e setores. |
| 6 | **Destino da branch** | A `claude/practical-dijkstra-zfagzj` tem vários commits à frente da `main` (ver `git log origin/main..HEAD`). **Em 28/10/2026** a `main` recebeu as duas entregas externas; a branch foi atualizada com ela (conflitos resolvidos, testes repetidos) e mesclada na `main` pela PR 3. **Resolvida.** | Feito: PR para a `main`. |
| 7 | **Repositório público** | O repositório está público: o README (com os acessos de teste) e este arquivo (regras de negócio, o nome do fornecedor Fortics) podem ser lidos por qualquer pessoa. Este arquivo evita citar outros sistemas internos por nome. | Manter público, ou tornar privado antes de documentar mais. |

### Entregas externas integradas (28/10/2026)

Duas entregas vieram do time e entraram na `main` por PR, **desligadas por padrão** (sem as variáveis, o sistema fica como antes). Cada uma tem roteiro de teste em `docs/`.

**Chamados de suporte no relatório** (mesclado na `main` em `9ac1ae2`)
- Mostra, no rascunho e no relatório emitido, quantos chamados de suporte o cliente teve no período (total, por sistema, por assunto, por motivo de encerramento e espera média). Os números são **congelados na emissão**.
- O gestor vê a lista de chamados com o atendente; o aprovador vê só totais e contagens. O PDF só traz o resumo se `CHAMADOS_SUPORTE_PDF=true`.
- Os dados vêm de um fluxo do n8n da SIDIM, que lê a tabela `atendimentos` (alimentada por outro fluxo que já existia). O servidor do ReportS é o único a chamar o n8n, com a chave no cabeçalho. Se o n8n falhar, o relatório sai com "Dados de suporte indisponíveis".
- **Testado em 28/10/2026** com o n8n real: o bloco trouxe o total, as três contagens e a lista, e a falha de configuração mostrou "indisponíveis" sem impedir o relatório. Os números ainda precisam ser **conferidos com a tabela `atendimentos`** pelo time que mantém o fluxo.
- Em aberto: quem preenche o "Nome no Fortics" dos clientes que já existem; esconder esse campo quando o recurso está desligado (hoje ele aparece); trocar a chave do n8n usada nos testes locais.

**Localização por CEP no check-in e no check-out** (mesclado na `main` em `974d774`)
- Troca a coordenada pelo CEP e pelo endereço em todas as telas (técnico, gestor, aprovador e PDF). A coordenada continua gravada por baixo. Carimbo opcional na foto do ambiente (data, hora e CEP).
- A conversão usa o OpenStreetMap (Nominatim) e, se faltar o CEP, o ViaCEP. Precisa de `GEOCODING_USER_AGENT` com um contato real da SIDIM.
- **Decisão da Helena (28/10/2026): o CEP e a precisão aparecem sempre como aproximados**, no estilo do WhatsApp ("CEP … (aproximado)", "Precisão: aprox. 94 m"). Já aplicado.
- **Testado em 28/10/2026** no computador, com os serviços reais: o CEP apareceu em todas as telas, sem coordenadas. Observação importante: o navegador do computador estima a posição por Wi-Fi e IP, e o mapa gratuito devolveu a via mais próxima, com um CEP diferente do oficial do endereço. Por isso o CEP é só uma referência, e a prova de presença mais confiável continua sendo a **distância até o estabelecimento** (ponto 6). No celular, com GPS, a posição deve ser bem melhor, mas isso **ainda não foi testado**.
- Em aberto: teste no celular com https; aviso de LGPD ao técnico (a coordenada vai a um serviço de terceiros); confirmar se o aprovador do cliente deve ver o CEP; o cadastro do estabelecimento ainda pede latitude e longitude digitadas.

### Login único entre sistemas · dependência nova (a organizar em arquivo próprio)

Surgiu em 27/10/2026: a ideia de unificar os acessos dos sistemas internos, com um cadastro central de usuários e um portal comum. O ponto que interessa aqui é a **ordem**: o banco real do ReportS (item de infraestrutura abaixo) prevê uma tabela de usuários. Se ela for criada antes da decisão de identidade, será descartada depois. Na parte do ReportS, a troca fica concentrada em `src/lib/repo/usuarios.ts`, `src/lib/session.ts` e `src/lib/dal.ts`. O plano completo será escrito à parte, a pedido.

### Pré-requisitos externos dos itens de infraestrutura (não verificados)

Não sabemos se já existem; precisam ser confirmados antes de cada item começar.

| Item | Precisa de |
|---|---|
| Banco de dados real e armazenamento | Um projeto Supabase (conta e credenciais) e a decisão de identidade acima |
| Envio real de e-mail | Uma caixa de e-mail da SIDIM dedicada (ex.: `relatorios@`), com SMTP liberado e SPF/DKIM no DNS do domínio |
| Tabela CBO oficial | O arquivo oficial do Ministério do Trabalho. Não testamos se o ambiente consegue baixá-lo |
| Publicação e teste no celular com https | Conta Vercel e o domínio |

### Ordem sugerida para resolver

1. **Decisões em aberto (2, 6 e 7).** São respostas rápidas e destravam o acabamento do que já foi feito.
2. **Ponto 5**: testar no computador local, com o serviço real e o endereço real de um estabelecimento (roteiro em `docs/teste-busca-coordenadas.md`).
3. **Login único**, antes do banco real.
4. **Pontos 4 e 9**, que dependem do time e do Fortics.
5. **Infraestrutura**, na ordem da seção "A fazer".

## A fazer

### Infraestrutura (vem do "Próximos passos" do README)

- [ ] **Alta** — Banco de dados real (Prisma + PostgreSQL/Supabase). A troca fica concentrada em `src/lib/repo/*`; as telas não mudam.
- [ ] **Alta** — Armazenamento de fotos, assinaturas e PDFs (Supabase Storage). Hoje ficam em memória.
- [ ] **Média** — Envio real de e-mail por **SMTP** (o Resend foi descartado por decisão de 28/10/2026). **Implementado, falta o teste real** (`EMAIL_REAL`, `SMTP_*`, trava `EMAIL_REDIRECIONAR_PARA`; roteiro em `docs/teste-email-real.md`). Falta ainda definir o e-mail da SIDIM que enviará aos aprovadores (caixa dedicada, SMTP liberado, SPF/DKIM). Sem as variáveis, segue simulado na Caixa de saída (`src/lib/email.ts`).
- [ ] **Média** — Importar a tabela CBO oficial do Ministério do Trabalho. Hoje é uma amostra de 25 ocupações, com códigos não conferidos. Ganha peso com a definição 2, em que o CBO passa a ser o único campo de ocupação.
- [ ] **Média** — Publicar (Vercel) e testar no celular com https. O GPS do check-in presencial só funciona em https ou em `localhost`.

### Documentação

- [ ] **Média** — Corrigir o comando do `.env.local` no README. O comando atual usa `>`, que no PowerShell do Windows grava o arquivo em UTF-16; o Next.js não lê, a chave de sessão fica vazia e o login quebra. Comando que funciona em qualquer terminal:

  ```bash
  node -e "require('fs').writeFileSync('.env.local', 'SESSION_SECRET=' + require('crypto').randomBytes(32).toString('base64') + '\nAPP_URL=http://localhost:3000\n')"
  ```

- [ ] **Média** — Trazer para o repositório o "guia" de regras de negócio que o README cita. Ele não está no repositório hoje.

### Qualidade

- [ ] **Média** — Testar o fluxo completo de ponta a ponta: check-in → check-out → emissão do relatório → aprovação pelo cliente.
  - Já verificado: login de gestor, técnico e técnico inativo (recusado); telas iniciais de Administração e Técnico sem erros de JavaScript.
  - Ainda não verificado: check-in e check-out, emissão do relatório, página de aprovação.

## Sugestões a avaliar

- [ ] **Baixa** — Acesso pelo GitHub Codespaces (navegador, com https). **Não testado.** O login usa Server Action, e a documentação do Next.js 16 indica que acesso por túnel ou proxy pode exigir `allowedOrigins` (em `experimental.serverActions`) e `allowedDevOrigins` no `next.config.ts`, liberando `*.app.github.dev`. Avaliar também um `devcontainer`. Em Codespaces, o `APP_URL` precisa ser o endereço público, senão os links de aprovação apontam para `localhost`.
- [ ] **Baixa** — Padronizar a versão do npm da equipe. O `npm install` com npm 10.9 remove campos `libc` do `package-lock.json`, gerando um diff sem significado. Enquanto não padronizar, não commitar esse diff.

## Concluído

- [x] Mockup completo das três interfaces (Administração, App do Técnico e Aprovação), com dados em memória — `745a349`.
- [x] README com como rodar, acessos de teste e situação atual — `c085435`.
- [x] Chamados de suporte do cliente no relatório (n8n/Fortics), desligado por padrão — mesclado em `9ac1ae2` (28/10/2026).
- [x] Localização por CEP no check-in/check-out, com CEP e precisão sempre "aproximados", desligado por padrão — mesclado em `974d774` (28/10/2026).
- [x] Definições 1, 2, 3, 6, 10, 11 e 12 e telefone do usuário — PR 3, mesclada em `ace1b3f` (28/10/2026).
- [x] CEP gravado na hora quando a prévia já o resolveu, e tela da visita que se atualiza sozinha enquanto o CEP está pendente — `c9b632a` e `5f182b9` (28/10/2026).
- [x] Selo "Dentro do raio" para o gestor, ao lado do "Fora do raio" — `f9581d2` (28/10/2026).
- [x] Ponto 5: botão "Buscar coordenadas pelo endereço" no cadastro do estabelecimento, testado com o serviço real — `8cc34fd` (28/10/2026).
- [x] Termo **"unidade" passa a ser "estabelecimento"** em telas, mensagens, PDF e documentação, por decisão com a Helena (28/10/2026). Os nomes internos do código (`unidadeId`, `Unidade`, `listarUnidades`) foram mantidos de propósito, para não arriscar uma refatoração grande sem ganho para o usuário.
