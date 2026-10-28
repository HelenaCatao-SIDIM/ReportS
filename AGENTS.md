<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SIDIM Visitas — convenções do projeto

Leia o `README.md` (como rodar, acessos de teste, situação atual) e o `docs/regras.md` (regras de negócio) antes de mudar o código.
**Mudou uma regra de negócio? Atualize `docs/regras.md` no mesmo commit.**

## Comandos

- `npm run dev` — servidor de desenvolvimento (http://localhost:3000). Precisa do `.env.local` (copie de `.env.example`).
- `npm run lint` — ESLint.
- `npm run build` — build de produção; também faz a checagem de tipos do TypeScript.

Não há testes automatizados. Antes de commitar, rode `npm run lint` e `npm run build`.

## Idioma

Código, nomes, comentários e mensagens em **português**. Identificadores sem acento (`buscarVisita`, `exigirGestorAcao`, `temaIds`); textos para o usuário com acentuação correta e em linguagem simples.

## Camadas

- **Dados: só em `src/lib/repo/*`.** Hoje é um mock em memória; na fase de banco (Prisma + Supabase), só essa pasta muda.
  - Todo arquivo começa com `import "server-only"`.
  - Funções são `async` mesmo no mock, para a assinatura não mudar com o banco.
  - Os dados ficam em `globalThis.__nome ??= seed()` para sobreviver ao recarregamento do `next dev`.
  - Telas e ações nunca mexem nos arrays diretamente: chamam funções do repositório.
- **Modelo de dados:** `src/lib/types.ts` (tipos compartilhados por servidor e navegador).
- **Regras usadas também no navegador:** `src/lib/visitas.ts` e `src/lib/regras-visita.ts` (sem `server-only`).
- **E-mail:** `src/lib/email.ts` (simulado; as mensagens aparecem em `/admin/emails`). **Arquivos:** `src/lib/repo/arquivos.ts`.

## Acesso

- `src/proxy.ts` faz só uma checagem otimista do cookie. Não confie nela.
- Páginas das áreas logadas ficam dentro de `AreaProtegida` (`src/components/shell/area-protegida.tsx`), que chama `exigirPerfil`.
- **Toda Server Action começa** com `exigirGestorAcao()`, `exigirTecnicoAcao()` ou `exigirLogadoAcao()` (`src/lib/dal.ts`).
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
- CPF completo **só** na tela de detalhe da visita do gestor. Em qualquer outro lugar, use `mascararCpf`.
- Texto digitado que entra em HTML de e-mail precisa ser escapado (veja `esc` em `src/lib/emissao.tsx`).
- Imagens: o navegador comprime com `comprimirImagem` (`src/lib/imagem.ts`) e o servidor valida com `salvarImagem`.

## Interface

- shadcn/ui sobre Base UI (`components.json`, estilo `base-nova`); componentes gerados em `src/components/ui/`.
- Tailwind CSS 4, ícones `lucide-react`, `cn` de `src/lib/utils.ts`.
- Administração é pensada para computador; App do Técnico e página do aprovador, para celular.
