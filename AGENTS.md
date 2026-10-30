<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SIDIM Visitas — convenções do projeto

Leia o `README.md` (como rodar, situação atual e publicação) e o `docs/regras.md` (regras de negócio) antes de mudar o código.
**Mudou uma regra de negócio? Atualize `docs/regras.md` no mesmo commit.**

## Comandos

- `npm run dev` — servidor de desenvolvimento (http://localhost:3000). Precisa do `.env.local` (copie de `.env.example`).
- `npm run lint` — ESLint.
- `npm run build` — build de produção; também faz a checagem de tipos do TypeScript (inclusive dos testes).
- `npm test` — testes (`tests/`, `node:test`); os de banco só rodam com `REPORTS_TEST_DATABASE_URL` (README, "Testes").
- `npm run db:migrate` e `npm run db:plataforma:conferir` — migrações do banco `reports` e conferência da estrutura da plataforma.

Antes de commitar, rode `npm run lint`, `npm test` e `npm run build`. **Teste o build de produção** (`npm run build` e `npm run start`), não só `npm run dev`: o Next.js só pré-carrega links e só aplica certas regras de cache na versão publicada (foi assim que um link "Sair" pré-carregado desconectou todo mundo no primeiro uso em produção, 30/10/2026).

## Idioma

Código, nomes, comentários e mensagens em **português**. Identificadores sem acento (`buscarVisita`, `exigirPermissaoAcao`, `temaIds`); textos para o usuário com acentuação correta e em linguagem simples.

## Camadas

- **Dados: só em `src/lib/repo/*`.** Dois bancos PostgreSQL com Prisma 7 e o adaptador `pg` (`src/lib/db.ts`): `reports` (do ReportS, com migrações próprias) e `plataforma` (comum com o SINC, que é quem define a estrutura; o ReportS lê e grava só as colunas liberadas ao seu usuário de banco, ADR-035 do SINC).
  - Todo arquivo começa com `import "server-only"`. Telas e ações nunca falam com o banco direto: chamam funções do repositório.
  - Inclusão na plataforma é em **SQL direto** (`$executeRaw`), porque o Prisma mandaria colunas com valor padrão que o usuário do ReportS não pode gravar.
  - Não há transação entre os dois bancos: grave na plataforma primeiro, depois no `reports`, numa ordem que deixe só estados corrigíveis se o segundo passo falhar.
  - Ids da plataforma são `bigint`; viram texto na fronteira (`idTexto`, `idPlataforma` em `src/lib/db.ts`).
  - Mudou uma tabela da plataforma? Rode `npm run db:plataforma:ler`, revise o `git diff` de `prisma/plataforma/schema.prisma` e publique antes do deploy (a conferência do `bin/deploy` para se o arquivo estiver desatualizado).
- **Modelo de dados:** `src/lib/types.ts` (tipos compartilhados por servidor e navegador).
- **Regras usadas também no navegador:** `src/lib/visitas.ts` e `src/lib/regras-visita.ts` (sem `server-only`).
- **E-mail:** `src/lib/email.ts` (todo e-mail fica registrado no banco e aparece em `/admin/emails`; o envio real é pelo SMTP). **Arquivos:** `src/lib/repo/arquivos.ts` (disco do servidor, `ARQUIVOS_DIR`).

## Acesso

- `src/proxy.ts` faz só uma checagem otimista do cookie. Não confie nela.
- O acesso é por **permissões** (`reports.*`, `src/lib/permissoes.ts`), lidas do cadastro a cada requisição; não existe perfil "gestor" nem "técnico" no código. Usuários e papéis são do SINC.
- Páginas e layouts chamam `exigirPermissao`, `exigirAdministracao` ou `exigirTecnico` (`src/lib/dal.ts`; o `AreaProtegida` em `src/components/shell/area-protegida.tsx` já faz isso para as áreas logadas); a tela da Administração diz quais permissões a liberam em `PERMISSOES_DA_TELA`.
- **Toda Server Action começa** com `exigirPermissaoAcao(PERMISSOES.…)` (`src/lib/dal.ts`).
- **Nunca ponha um `GET` com efeito colateral atrás de um `<Link>`** (sair, apagar, aprovar): o Next.js pré-carrega links visíveis. Efeito colateral é Server Action ou `POST`. Sair é a ação `logout`.
- Redirecionamento em route handler atrás do nginx: use endereço **relativo** (`Location: /login`); `req.nextUrl` traz o host interno (`localhost:3100`).
- A página do aprovador (`/aprovacao/[token]`) não tem login: o acesso é validado pelo token com `buscarPorLink`.

## Server Actions e formulários

- Ficam em `actions.ts` (com `"use server"`) ao lado da rota que as usa.
- Leia o `FormData` com `String(fd.get("campo") ?? "").trim()`. Valide no servidor e junte os erros por campo em `erros`.
- Com erro, devolva `{ erros, valores }` para o formulário mostrar as mensagens sem perder o que foi digitado.
- Com sucesso, chame `revalidatePath(...)` e `redirect(...?ok=...)`. A página lê `ok` para mostrar a confirmação.
- Formulários longos usam `useAcao` (`src/components/form/use-acao.ts`), que não limpa os campos quando há erro.

## Dados sensíveis e formatos

- Datas: guarde em ISO (UTC) e exiba no horário de Brasília com `src/lib/datas.ts`. Entrada e saída do técnico usam a hora do servidor.
- CPF e CNPJ: guarde só os dígitos e valide com `cpfValido`/`cnpjValido` (`src/lib/format.ts`).
- CPF completo **só** na tela de detalhe da visita, na Administração. Em qualquer outro lugar, use `mascararCpf`. O CPF nunca aparece no SINC.
- Texto digitado que entra em HTML de e-mail precisa ser escapado (veja `esc` em `src/lib/emissao.tsx`).
- Imagens: o navegador comprime com `comprimirImagem` (`src/lib/imagem.ts`) e o servidor valida com `salvarImagem`.

## Interface

- shadcn/ui sobre Base UI (`components.json`, estilo `base-nova`); componentes gerados em `src/components/ui/`.
- Tailwind CSS 4, ícones `lucide-react`, `cn` de `src/lib/utils.ts`.
- Administração é pensada para computador; App do Técnico e página do aprovador, para celular.
