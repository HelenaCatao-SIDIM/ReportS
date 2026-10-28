# SIDIM Visitas

Sistema web responsivo para registrar e comprovar o comparecimento dos técnicos de suporte da SIDIM nos clientes:
do check-in em campo até o relatório periódico aprovado pelo cliente (que libera o faturamento).

Três interfaces:

- **Administração** (gestor, computador): usuários, clientes (aprovadores, estabelecimentos e setores), temas, participantes, gestão de visitas e relatórios.
- **App do Técnico** (celular ou computador): check-in com GPS e foto, temas, fotos extras, lista de presença (com assinatura quando o cliente exige), check-out e histórico.
- **Aprovação** (cliente, sem login): página aberta pelo link do e-mail para aprovar o relatório ou pedir ajuste.

Tecnologia: Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui (Base UI). PDF com `@react-pdf/renderer`.

## Situação atual: mockup funcional com dados em memória

Todas as telas e regras do guia estão implementadas, mas **os dados ficam na memória do servidor**:

- ao reiniciar o servidor, tudo volta aos dados de exemplo;
- e-mails não são enviados: aparecem em **Administração → Caixa de saída (teste)**;
- fotos, assinaturas e PDFs também ficam em memória;
- a tabela CBO é uma **amostra de 25 ocupações** (códigos não conferidos) — falta importar a tabela oficial.

A troca para banco de dados real (Prisma + PostgreSQL/Supabase) fica concentrada em `src/lib/repo/*`; as telas não mudam.

## Como rodar no seu computador

Pré-requisitos: [Node.js](https://nodejs.org) 20 ou mais novo e [Git](https://git-scm.com).

```bash
git clone https://github.com/HelenaCatao-SIDIM/ReportS.git
cd ReportS
npm install
```

Crie o arquivo `.env.local` na raiz do projeto (ele não vai para o Git porque guarda uma chave secreta):

```bash
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('base64')); console.log('APP_URL=http://localhost:3000')" > .env.local
```

- `SESSION_SECRET`: chave usada para assinar a sessão de login (qualquer texto aleatório longo).
- `APP_URL`: endereço usado nos links dos e-mails de aprovação.

Opcional — **localização por CEP** (desligada por padrão; com ela desligada, nada muda):

```bash
LOCALIZACAO_POR_CEP=true
CARIMBO_FOTO=true
GEOCODING_USER_AGENT=SIDIM-Visitas/1.0 (contato@sidimsistemas.com.br)
```

- `LOCALIZACAO_POR_CEP`: converte a coordenada do check-in/check-out em **CEP + endereço** e mostra o CEP
  no lugar da latitude/longitude em todas as telas (técnico, gestor e aprovador). A coordenada continua gravada.
- `CARIMBO_FOTO`: escreve data/hora e CEP no rodapé da foto do ambiente (nunca coordenadas).
- `GEOCODING_USER_AGENT`: nome do sistema e um e-mail de contato, exigidos pelo Nominatim.

Opcional — **envio real de e-mail** pelo [Resend](https://resend.com) (desligado por padrão; com ele desligado, os e-mails só
aparecem na Caixa de saída, como antes):

```bash
EMAIL_REAL=true
RESEND_API_KEY=<chave criada no painel do Resend; nunca vai para o Git>
EMAIL_REMETENTE=SIDIM Relatórios <relatorios@seu-dominio-verificado>
EMAIL_REDIRECIONAR_PARA=voce@sidimsistemas.com.br
```

- `EMAIL_REAL` + `RESEND_API_KEY`: ligam o envio real. A chave fica só no servidor (`src/lib/email.ts`).
- `EMAIL_REMETENTE`: de quem o e-mail sai. Sem ele, usa o remetente de testes do Resend (`onboarding@resend.dev`), que só entrega
  ao e-mail do dono da conta. Para enviar aos aprovadores, verifique um domínio da SIDIM no Resend.
- `EMAIL_REDIRECIONAR_PARA`: **trava de teste**. Enquanto estiver definida, todo e-mail vai para este endereço, com o destinatário
  original no assunto (`[TESTE → Nome <email>]`). Remova só quando for enviar de verdade aos clientes.
- O PDF vai em anexo (até 8 MB), há versão só texto, e uma falha de envio nunca desfaz a emissão: aparece como "Falhou" na Caixa de saída.
- `APP_URL` precisa ser o endereço **público** do sistema; com `localhost`, o link do e-mail só abre no mesmo computador.

Roteiro de teste em `docs/teste-email-real.md`.

Opcional — **busca de coordenadas pelo endereço** (desligada por padrão), no cadastro do estabelecimento:

```bash
BUSCA_COORDENADAS=true
GEOCODING_USER_AGENT=SIDIM-Visitas/1.0 (contato@sidimsistemas.com.br)
```

- `BUSCA_COORDENADAS`: mostra o botão **"Buscar coordenadas pelo endereço"** em Clientes → estabelecimento → Editar. Ele preenche
  latitude e longitude pelo [Nominatim](https://operations.osmfoundation.org/policies/nominatim/); os campos continuam editáveis.
  A busca acerta a rua, não a porta, então o gestor confere (há um link "Ver no mapa"). Inclua cidade e UF no endereço.
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

> Se uma tela mostrar o erro "… is not a function" depois de alterar um arquivo, pare o servidor (Ctrl+C) e rode `npm run dev` de novo — às vezes o recarregamento automático fica com uma versão antiga do arquivo. Os dados de exemplo voltam ao estado inicial.

## Acessos de teste

Senha de todos os usuários de teste: **`sidim123`** (definida em `src/lib/repo/usuarios.ts`; só para desenvolvimento).

| Perfil | E-mail | Observação |
|---|---|---|
| Gestor | `gestor@sidim.com.br` | Administração e Relatórios |
| Técnico | `ana@sidim.com.br` | começa com uma visita aberta |
| Técnico | `carlos@sidim.com.br` | começa com uma visita aberta |
| Técnico inativo | `paulo@sidim.com.br` | o login é recusado (teste de bloqueio) |

**Aprovador (cliente) não tem login.** Ele entra pelo link pessoal enviado no e-mail do relatório. Para testar:
entre como gestor → **Relatórios → Novo relatório** → emita → **Caixa de saída (teste)** → **"Ver relatório"**.

| Aprovador | Cliente |
|---|---|
| Marta Ribeiro, José Antunes | Prefeitura de Vale Verde (comprovação **Assinada**, exige CPF) |
| Renata Lopes | Clínica Bem Viver (comprovação **Nominal**) |

Para ver o check-in do técnico, ele não pode ter visita aberta: faça o check-out da visita de exemplo
(ou, como gestor, cancele-a em **Visitas → Em andamento**).

## Testar no celular

Com o celular na mesma rede Wi-Fi, abra `http://<IP-do-computador>:3000` (o `npm run dev` mostra o endereço "Network").
Câmera e assinatura funcionam; o **GPS só funciona em https** (ou em `localhost`), então o check-in presencial fica bloqueado
nesse endereço — use um treinamento online para testar sem GPS.

## Estrutura

- `src/proxy.ts` — redireciona por perfil (checagem rápida do cookie de sessão)
- `src/lib/session.ts`, `src/lib/dal.ts` — sessão (JWT em cookie httpOnly) e verificação de acesso
- `src/lib/repo/*` — **camada de dados (mock em memória)**: usuários, clientes, temas, participantes, CBO, visitas, relatórios, arquivos
- `src/lib/emissao.tsx`, `src/lib/pdf/` — geração do PDF e envio (simulado) dos e-mails do relatório
- `src/lib/email.ts` — envio de e-mail (simulado; trocar pelo provedor real)
- `src/app/admin/*` — Administração (gestor)
- `src/app/tecnico/*` — App do Técnico
- `src/app/aprovacao/[token]/*` — página do aprovador (sem login)
- `src/components/*` — componentes de tela (formulários, visita, relatório, shell)

## Próximos passos

1. Banco de dados real (Prisma + Supabase) em `src/lib/repo/*`.
2. Armazenamento de fotos, assinaturas e PDFs (Supabase Storage).
3. Envio real de e-mail (Resend) com o domínio da SIDIM.
4. Importar a tabela CBO oficial do Ministério do Trabalho.
5. Publicar (Vercel) e testar em celular com https.

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
- Em cada cliente, preencha **"Nome no Fortics"** (como ele aparece no campo Cliente / Município do Fortics).
- Os números são buscados na emissão e **congelados na versão**: PDF, página do aprovador e versões antigas mostram sempre o mesmo número.
- Só o servidor chama o n8n, com a chave. Se o n8n falhar, o relatório é emitido com "Dados de suporte indisponíveis".
- O aprovador vê só os totais e as contagens (sem a lista de chamados e sem nomes de atendentes).
- `CHAMADOS_SUPORTE_PDF=true` coloca o resumo também na capa do PDF.
