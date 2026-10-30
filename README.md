# SIDIM Visitas

Sistema web responsivo para registrar e comprovar o comparecimento dos técnicos de suporte da SIDIM nos clientes:
do check-in em campo até o relatório periódico aprovado pelo cliente (que libera o faturamento).

Três interfaces:

- **Administração** (computador; as telas que cada pessoa vê dependem das permissões): usuários e permissões (aviso do SINC), clientes (sistemas e contratos, estabelecimentos e setores), aprovadores, temas, participantes, gestão de visitas e relatórios.
- **App do Técnico** (celular ou computador): check-in com GPS e foto (escolhendo o cliente e o sistema), temas do sistema, fotos extras, lista de presença (com assinatura quando o contrato exige), check-out e histórico.
- **Aprovação** (cliente, sem login): página aberta pelo link do e-mail para aprovar o relatório ou pedir ajuste.

Tecnologia: Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui (Base UI). PDF com `@react-pdf/renderer`.

## Situação atual: Fase 4, com banco de dados

Desde 30/10/2026 os dados ficam no PostgreSQL, em dois bancos (plano "Plataforma SIDIM", Fase 4):

- **`plataforma`**, comum com o SINC, que define a estrutura dele: sistemas, usuários da SIDIM, papéis e permissões, clientes,
  sistemas do cliente e participantes. O ReportS lê e grava só as colunas liberadas ao seu usuário de banco (ADR-035 do SINC).
- **`reports`**, só do ReportS, com migrações próprias: estabelecimentos, setores, contratos, aprovadores, temas, CBO, visitas,
  relatórios, links de aprovação, arquivos e e-mails.

Login com o e-mail e a senha do cadastro único (os mesmos do SINC); usuários, papéis e senhas são gerenciados no Admin do SINC.
Fotos, assinaturas e PDFs ficam no disco do servidor (`ARQUIVOS_DIR`). Os e-mails ficam registrados no banco e aparecem em
**Administração → Caixa de saída**; o envio real é pelo SMTP da SIDIM. A tabela CBO oficial é carregada por script.

## Como rodar no seu computador

Pré-requisitos: [Node.js](https://nodejs.org) 22 (o Prisma 7 pede 20.19 ou mais novo), PostgreSQL 16, [Git](https://git-scm.com)
e o **SINC de desenvolvimento** rodando no mesmo PostgreSQL, com o banco `plataforma` migrado (é ele que cria as tabelas comuns e os
usuários).

1. Usuário e banco do ReportS (uma vez; troque a senha):

   ```bash
   sudo -u postgres psql -c "CREATE ROLE reports LOGIN PASSWORD 'senha-dev'"
   sudo -u postgres createdb -O reports reports_development
   ```

   No SINC, aplique as permissões desse usuário na plataforma: `bin/rails plataforma:permissoes_reports`.

2. Projeto:

   ```bash
   git clone https://github.com/HelenaCatao-SIDIM/ReportS.git
   cd ReportS
   npm install          # também gera os clientes do Prisma (src/generated/, fora do Git)
   ```

3. Crie o arquivo `.env.local` na raiz do projeto (ele não vai para o Git porque guarda segredos). O comando abaixo funciona em
qualquer terminal, inclusive no PowerShell do Windows; depois acrescente as linhas dos bancos:

```bash
node -e "require('fs').writeFileSync('.env.local', 'SESSION_SECRET=' + require('crypto').randomBytes(32).toString('base64') + '\nAPP_URL=http://localhost:3000\n')"
```

```bash
REPORTS_DATABASE_URL=postgresql://reports:senha-dev@localhost:5432/reports_development
PLATAFORMA_DATABASE_URL=postgresql://reports:senha-dev@localhost:5432/plataforma_development
SINC_URL=http://localhost:3001
ARQUIVOS_DIR=./tmp/arquivos
```

Não use `> .env.local` no PowerShell: ele grava o arquivo em UTF-16, o Next.js não o lê, a chave de sessão fica vazia e o login
quebra com "Zero-length key". Ao acrescentar variáveis depois, cada uma fica em uma linha própria (confira se duas não ficaram grudadas).

- `SESSION_SECRET`: chave usada para assinar a sessão de login (qualquer texto aleatório longo).
- `APP_URL`: endereço usado nos links dos e-mails de aprovação.
- `REPORTS_DATABASE_URL` e `PLATAFORMA_DATABASE_URL`: os dois bancos, com o mesmo usuário `reports`.
- `SINC_URL`: endereço do SINC, para o "Esqueci minha senha" e o aviso da tela "Usuários e permissões" (padrão `https://sinc.sidim.com.br`).
  A tela de login é gerada no build: em produção, a variável precisa estar definida antes do `npm run build`.
- `ARQUIVOS_DIR`: pasta das fotos, assinaturas e PDFs (em desenvolvimento, `./tmp/arquivos`; em produção, obrigatória e fora do projeto).

4. Banco do ReportS, catálogo de permissões e dados de exemplo:

```bash
npm run db:migrate             # cria as tabelas do banco reports
npm run permissoes:registrar   # grava as permissões reports.* na plataforma
npm run db:exemplo             # só em desenvolvimento: CBO de amostra, temas, aprovadores, estabelecimentos e contratos
```

Opcional — **localização por CEP** (desligada por padrão; com ela desligada, nada muda):

```bash
LOCALIZACAO_POR_CEP=true
CARIMBO_FOTO=true
GEOCODING_USER_AGENT=SIDIM-Visitas/1.0 (contato@sidimsistemas.com.br)
```

- `LOCALIZACAO_POR_CEP`: converte a coordenada do check-in/check-out em **CEP + endereço** e mostra o CEP
  no lugar da latitude/longitude em todas as telas (técnico, administração e aprovador). A coordenada continua gravada.
- `CARIMBO_FOTO`: escreve data/hora e CEP no rodapé da foto do ambiente (nunca coordenadas).
- `GEOCODING_USER_AGENT`: nome do sistema e um e-mail de contato, exigidos pelo Nominatim.

Opcional — **endereço do SINC** (onde ficam os usuários e as permissões), mostrado no aviso da tela "Usuários e permissões":

- `SINC_URL` (padrão `https://sinc.sidim.com.br`).

Opcional — **envio real de e-mail** (desligado por padrão; com ele desligado, os e-mails só aparecem na Caixa de saída,
como antes). O caminho da SIDIM é o **servidor SMTP da própria empresa** (Oracle Cloud Email Delivery), o mesmo que os outros
sistemas usam (decisão D-04).

```bash
EMAIL_REAL=true
SMTP_HOST=smtp.email.<região>.oci.oraclecloud.com
SMTP_PORTA=587
SMTP_USUARIO=<usuário SMTP do OCI; não é um e-mail, costuma começar com ocid1.user...>
SMTP_SENHA=<senha SMTP do OCI; nunca vai para o Git>
EMAIL_REMETENTE=Sidim Sistemas <remetente aprovado no OCI>
EMAIL_REDIRECIONAR_PARA=voce@sidimsistemas.com.br
```

- `EMAIL_REAL` + `SMTP_HOST`: ligam o envio real por SMTP (`src/lib/email.ts`). Usuário e senha ficam só no servidor.
- `SMTP_PORTA=587` usa STARTTLS (é o `EnableSsl: true` das configurações dos outros sistemas). A conexão sobe para TLS antes de enviar
  usuário e senha, e o sistema se recusa a enviá-los a um servidor fora do seu computador que não ofereça TLS. `465` abre a conexão já
  criptografada. Não use `SMTP_SEGURO=true` com a 587.
- `EMAIL_REMETENTE`: **obrigatório no OCI**. O usuário do OCI não é um endereço de e-mail, e o remetente precisa ser um *Approved Sender*
  cadastrado lá. O formato é `Nome de exibição <endereço>`.
- `EMAIL_REDIRECIONAR_PARA`: **trava de teste**. Enquanto estiver definida, todo e-mail vai para este endereço, com o destinatário
  original no assunto (`[TESTE → Nome <email>]`). Remova só quando for enviar de verdade aos clientes.
- O PDF vai em anexo (até 8 MB), há versão só texto, e uma falha de envio nunca desfaz a emissão: aparece como "Falhou" na Caixa de saída.
- `APP_URL` precisa ser o endereço **público** do sistema; com `localhost`, o link do e-mail só abre no mesmo computador.
- As credenciais do SMTP são segredos: ficam só no `.env.local` (ou nas variáveis do servidor de produção), nunca no repositório, no chat
  ou em e-mail.

Gmail e Microsoft 365 também funcionam por SMTP (só para teste). O envio pelo Resend, dos primeiros testes, foi retirado.

Roteiro de teste em `docs/teste-email-real.md`.

Opcional — **busca de coordenadas pelo endereço** (desligada por padrão), no cadastro do estabelecimento:

```bash
BUSCA_COORDENADAS=true
GEOCODING_USER_AGENT=SIDIM-Visitas/1.0 (contato@sidimsistemas.com.br)
```

- `BUSCA_COORDENADAS`: mostra o botão **"Buscar coordenadas pelo endereço"** em Clientes → estabelecimento → Editar. Ele preenche
  latitude e longitude pelo [Nominatim](https://operations.osmfoundation.org/policies/nominatim/); os campos continuam editáveis.
  A busca acerta a rua, não a porta, então a administração confere (há um link "Ver no mapa"). Inclua cidade e UF no endereço.
- Usa o mesmo `GEOCODING_USER_AGENT` e a mesma fila de 1 consulta por segundo da localização por CEP
  (`src/lib/geocodificar.ts`). Roteiro de teste em `docs/teste-busca-coordenadas.md`.

A conversão usa duas APIs gratuitas, sem chave, chamadas só pelo servidor (`src/lib/cep.ts`):
[Nominatim/OpenStreetMap](https://operations.osmfoundation.org/policies/nominatim/) (no máximo 1 consulta por segundo,
com cache) e, quando ele não traz o CEP, o [ViaCEP](https://viacep.com.br) pela rua — nesse caso o CEP aparece como
"aproximado". Falha nas APIs nunca bloqueia o check-in: o CEP é buscado de novo depois. Roteiro de teste em
`docs/teste-localizacao-cep.md`.

Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

Abra http://localhost:3000.

> Se uma tela mostrar o erro "… is not a function" depois de alterar um arquivo, pare o servidor (Ctrl+C) e rode `npm run dev` de novo — às vezes o recarregamento automático fica com uma versão antiga do arquivo. Os dados continuam no banco.

## Acessos de teste

Os usuários são os do SINC de desenvolvimento (banco `plataforma`), com a mesma senha de lá. Não existe perfil "gestor": cada pessoa
tem **papéis**, e os papéis somam **permissões** (`src/lib/permissoes.ts`). O papel **Administrador** do SINC tem todas as permissões,
inclusive as do ReportS. Para testar outros perfis, crie papéis com algumas permissões `reports.*` em **Admin do SINC → Usuários → Papéis**.
Quem tem as duas áreas (Administração e App do Técnico) escolhe uma depois do login e troca por "Trocar de área"; quem não tem
nenhuma permissão do ReportS vê o aviso de que não tem acesso.

**Aprovador (cliente) não tem login.** Ele entra pelo link pessoal enviado no e-mail do relatório. Para testar:
**Administração → Relatórios → Novo relatório** (cliente, **sistema** e período) → emita → **Caixa de saída (teste)** → **"Ver relatório"**.
O cliente precisa ter CNPJ (os que vieram do SINC começam com "CNPJ pendente": preencha em **Clientes → Editar**).

Os dados de exemplo (`npm run db:exemplo`) criam, para os clientes que já existem no SINC de desenvolvimento, um estabelecimento
"Sede" com três setores e um contrato por sistema do cliente, com dois aprovadores. Cliente com dois sistemas tem **dois relatórios
por período**, um por contrato.

## Testar no celular

Com o celular na mesma rede Wi-Fi, abra `http://<IP-do-computador>:3000` (o `npm run dev` mostra o endereço "Network").
Câmera e assinatura funcionam; o **GPS só funciona em https** (ou em `localhost`), então o check-in presencial fica bloqueado
nesse endereço — use um treinamento online para testar sem GPS.

## Estrutura

- `src/proxy.ts` — só confere se há sessão; a área certa (Administração ou App do Técnico) é decidida pelas permissões, na página `/inicio`
- `src/lib/session.ts`, `src/lib/dal.ts`, `src/lib/permissoes.ts` — sessão (JWT em cookie httpOnly com só o id do usuário), verificação de permissão (uma para páginas, outra para ações; lida a cada requisição, sem cache) e catálogo de permissões
- `src/lib/limite-login.ts` — até 10 tentativas de login em 3 minutos por IP (RN-PL-55)
- `src/lib/db.ts` — conexões com os dois bancos (Prisma 7 com o adaptador `pg`); ids da plataforma viram texto na fronteira
- `src/lib/repo/*` — **camada de dados**: usuários, papéis e permissões, sistemas, clientes e participantes (plataforma); estabelecimentos, contratos, aprovadores, temas, CBO, visitas, relatórios e arquivos (reports)
- Participantes: por sistema do cliente, **confirmado pelo ERP** ou **provisório**, com busca por CPF e nome parecido antes de criar (`src/lib/repo/participantes.ts`, `src/lib/similaridade.ts`)
- `src/lib/emissao.tsx`, `src/lib/pdf/` — geração do PDF e envio dos e-mails do relatório
- `src/lib/email.ts` — envio pelo SMTP (ou simulado) e registro de todo e-mail no banco
- `src/app/admin/*` — Administração (cada tela exige a sua permissão)
- `src/app/tecnico/*` — App do Técnico
- `src/app/aprovacao/[token]/*` — página do aprovador (sem login)
- `src/components/*` — componentes de tela (formulários, visita, relatório, shell)
- `prisma/reports/` — schema e migrações do banco do ReportS; `prisma/plataforma/schema.prisma` — estrutura da plataforma, só lida do banco (`npm run db:plataforma:ler`), nunca migrada daqui
- `scripts/` — tarefas de linha de comando (abaixo); `tests/` — testes; `bin/deploy` e `deploy/` — publicação

## Scripts

| Comando | O que faz |
|---|---|
| `npm run db:migrate` | Aplica as migrações do banco `reports` (`db:migrate:dev` cria uma nova em desenvolvimento) |
| `npm run db:plataforma:ler` | Relê a estrutura da plataforma para `prisma/plataforma/schema.prisma` (depois de o SINC mudar uma tabela) |
| `npm run db:plataforma:conferir` | Falha se a estrutura da plataforma mudou e o arquivo não foi relido (roda no deploy, antes do build) |
| `npm run permissoes:registrar` | Grava o catálogo `reports.*` na plataforma: inclui, atualiza e inativa o que saiu do código (roda no deploy) |
| `npm run cbo:importar -- "CBO2002 - Ocupacao.csv"` | Importa a tabela CBO oficial (arquivo do site da CBO, mtecbo.gov.br): inclui e atualiza, nunca apaga |
| `npm run ceps:preencher` | Converte em CEP as coordenadas que ficaram pendentes (timer `reports-ceps` no servidor) |
| `npm run db:exemplo` | Dados de exemplo, só em desenvolvimento e com o banco `reports` vazio |
| `npm test` | Testes (abaixo) |

## Testes

```bash
sudo -u postgres createdb -O reports reports_test     # uma vez
REPORTS_TEST_DATABASE_URL=postgresql://reports:senha-dev@localhost:5432/reports_test npm test
```

Testes com `node:test` (`tests/`): as regras de permissão e, no banco de testes (migrado e esvaziado a cada teste), a visita única em
andamento por técnico, fotos enviadas ao mesmo tempo, o CEP gravado dentro do local, o ciclo do relatório (rascunho, emissão, primeira
decisão vale, visitas travadas) e as verificações do banco. A plataforma de desenvolvimento só é lida. Sem `REPORTS_TEST_DATABASE_URL`,
os testes de banco são pulados.

## Publicação

O ReportS roda no servidor do SINC, atrás do nginx, em `https://reports.sidim.com.br`. **O que está na `main` vai para produção** pelo
`bin/deploy`: `git pull`, `npm ci`, conferência da estrutura da plataforma, build, migrações do banco `reports`, registro das permissões
e reinício do serviço `reports-web`.

Antes, o SINC precisa estar publicado com as Fases 0 a 4 (inclusive a permissão de coluna `customers.ativo` para o usuário `reports`).

Primeira instalação (uma vez, no servidor):

1. Node.js 22 instalado no sistema (`/usr/bin/node`, por exemplo pelo NodeSource).
2. Usuário de banco e banco do ReportS (se o usuário `reports` ainda não existe, ver a Arquitetura do SINC, "Usuário do ReportS no banco
   plataforma"); depois, no SINC, `RAILS_ENV=production bin/rails plataforma:permissoes_reports`:

   ```bash
   sudo -u postgres createdb -O reports reports_production
   ```

3. Clone o repositório na pasta de serviços (o modelo usa `/home/ubuntu/ReportS`, com o usuário `ubuntu`; ajuste os arquivos de
   `deploy/` se o SINC usar outros) e crie o `.env.local` de produção:

   ```bash
   SESSION_SECRET=<aleatório, 32 bytes ou mais>
   APP_URL=https://reports.sidim.com.br
   SINC_URL=https://sinc.sidim.com.br
   REPORTS_DATABASE_URL=postgresql://reports:<senha>@localhost:5432/reports_production
   PLATAFORMA_DATABASE_URL=postgresql://reports:<senha>@localhost:5432/plataforma_production
   ARQUIVOS_DIR=/var/lib/reports/arquivos
   # e-mail (SMTP da SIDIM), localização por CEP e chamados de suporte: ver acima
   ```

   Confira o nome do banco plataforma de produção no `config/database.yml` do SINC.

4. Pasta dos arquivos: `sudo mkdir -p /var/lib/reports/arquivos && sudo chown ubuntu: /var/lib/reports/arquivos`.
5. Serviços e nginx: copie `deploy/reports-web.service`, `deploy/reports-ceps.service` e `deploy/reports-ceps.timer` para
   `/etc/systemd/system/`, `sudo systemctl daemon-reload && sudo systemctl enable reports-web reports-ceps.timer`; copie
   `deploy/nginx-reports.conf` para `/etc/nginx/sites-available/reports`, ligue o site e rode `sudo certbot --nginx -d reports.sidim.com.br`.
   O nginx precisa mandar o `X-Real-IP` (o modelo já manda): o limite de tentativas de login depende dele.
6. `bin/deploy`, e depois `npm run cbo:importar -- "<arquivo oficial>"` uma vez.
7. Backup: o banco `reports_production` e a pasta `ARQUIVOS_DIR` precisam entrar no backup do servidor, junto com os bancos do SINC
   (em aberto com a Helena: QA-002 do SINC).

## Plataforma SIDIM (SINC + ReportS)

Decisão de 29/10/2026: o ReportS e o SINC passam a ser dois serviços de um mesmo produto, apoiados numa base comum (banco `plataforma`, no mesmo PostgreSQL). O plano completo (24 decisões, fases 0 a 5, regras RN-PL) está no documento "Plataforma SIDIM — Unificação SINC + ReportS" da Helena; o resumo para o ReportS:

- **Sai** o plano anterior (Supabase, Vercel, Resend). **Entram** o servidor do SINC (https em `reports.sidim.com.br`), o banco `reports`, a base `plataforma` (só o SINC cria e altera tabelas lá), o disco do servidor para fotos, assinaturas e PDFs, e o SMTP da SIDIM para e-mails.
- Sistemas (SERP, SCA, SE, Saúde), clientes, participantes e usuários da SIDIM passam a ter **uma fonte só**, na plataforma. O ReportS deixa de ter cadastro próprio de usuários e de clientes; o perfil "gestor" vira permissões.
- O ReportS adaptou o protótipo **em memória** enquanto o SINC fazia as Fases 0 a 3 e passou a usar banco na Fase 4 (30/10/2026).
- **Biblioteca de banco: Prisma 7.x**, como o plano sugere: um schema do Prisma por banco, `reports` com migrações próprias e `plataforma` só por introspecção (o ReportS nunca altera a estrutura dela). Detalhes no `MELHORIAS.md`.

Andamento do ReportS (detalhes no `MELHORIAS.md`): **Fases 0 a 3** feitas em memória; **Fase 4** feita em 30/10/2026: os dois bancos,
login no cadastro único com limite de tentativas e "Esqueci minha senha" no SINC, catálogo de permissões registrado na plataforma,
arquivos em disco, e-mails registrados, CBO oficial por script, tarefa dos CEPs, testes e publicação (`bin/deploy`). Falta o filtro dos
chamados de suporte por sistema (Fase 2). A **Fase 5** (junção de participantes) vem depois.

## Próximos passos

1. Publicar no servidor (seção "Publicação"), importar a CBO oficial e testar no celular, com https.
2. Backup do banco `reports` e da pasta de arquivos (QA-002 do SINC, em aberto).
3. Envio real de e-mail pelo SMTP da SIDIM: implementado e testado com o serviço real; falta o SPF/DKIM do remetente e tirar a trava
   `EMAIL_REDIRECIONAR_PARA` quando for enviar aos clientes.
4. Chamados de suporte filtrados pelo sistema do contrato (parâmetro novo no fluxo do n8n).
5. Fase 5: junção de participantes (provisório com confirmado).

## Chamados de suporte no relatório (opcional)

Mostra no relatório quantos chamados de suporte o cliente **abriu e teve fechados** no período, a partir dos
atendimentos do Fortics que o n8n da SIDIM já guarda (tabela `atendimentos`). Desligado por padrão.

```bash
CHAMADOS_SUPORTE=true
CHAMADOS_SUPORTE_PDF=false
N8N_RESUMO_CHAMADOS_URL=https://<seu-n8n>/webhook/resumo-chamados-cliente
N8N_RESUMO_CHAMADOS_CHAVE=<a mesma chave da credencial "Chave Reports Sidim" no n8n>
```

- O fluxo do n8n está em `docs/n8n-resumo-chamados.json` (importar no n8n) e o passo a passo em `docs/n8n-resumo-chamados.md`.
- Em cada cliente, preencha **"Nome no SINC"** (o nome do cliente no SINC, o mesmo do campo Cliente / Município dos atendimentos). O campo só aparece com `CHAMADOS_SUPORTE=true`.
- Os números são buscados na emissão e **congelados na versão**: PDF, página do aprovador e versões antigas mostram sempre o mesmo número.
- Só o servidor chama o n8n, com a chave. Se o n8n falhar, o relatório é emitido com "Dados de suporte indisponíveis".
- O aprovador vê só os totais e as contagens (sem a lista de chamados e sem nomes de atendentes).
- `CHAMADOS_SUPORTE_PDF=true` coloca o resumo também na capa do PDF.
