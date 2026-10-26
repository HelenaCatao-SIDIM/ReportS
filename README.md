# SIDIM Visitas

Registro de visitas e treinamentos da SIDIM (Next.js 16 + TypeScript + Tailwind + shadcn/ui).

## Rodar localmente

```bash
npm install
npm run dev
```

Abra http://localhost:3000. O arquivo `.env.local` precisa de `SESSION_SECRET` (qualquer texto aleatório longo).

## Fase atual: mockup com dados em memória

Os dados ficam em `src/lib/repo/*` (mock em memória). Na fase de banco, só essa camada é trocada por Prisma/Postgres.

Usuários de teste (senha de todos em `src/lib/repo/usuarios.ts`):

| E-mail | Perfil |
|---|---|
| gestor@sidim.com.br | Gestor |
| ana@sidim.com.br | Técnico |
| carlos@sidim.com.br | Técnico |
| paulo@sidim.com.br | Técnico inativo (não entra) |

## Estrutura

- `src/proxy.ts` — redireciona por perfil (checagem otimista do cookie)
- `src/lib/session.ts` / `src/lib/dal.ts` — sessão (JWT em cookie httpOnly) e verificação de acesso
- `src/app/admin/*` — Administração (gestor)
- `src/app/tecnico/*` — App do Técnico (celular)
