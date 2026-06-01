# ☕ VersoCafé

App PWA para organizar o rodízio de café da equipe **em duplas** e um **chat interno**
com foto + comentário. Cada dia, 2 pessoas fazem o café; ninguém repete até que todos os
demais já tenham passado (rodízio justo por *rounds*). Cadastro com aprovação do admin.

## Funcionalidades

- 🔐 **Login/senha** com cadastro **pré-aprovado pelo admin** (pendente → ativo).
- ☕ **Rodízio automático** de duplas (seg–qui por padrão), sem repetição dentro do round.
- 📅 **Escala** com próximos dias, histórico e progresso da rodada.
- 💬 **Chat em grupo** em tempo real (Socket.io) com **foto + comentário**.
- 🔔 **Notificações push** (Web Push/VAPID): "hoje é a sua vez" e novas mensagens.
- 📱 **PWA** instalável no celular (manifest + service worker + offline básico).
- 🛠️ **Painel admin**: aprovar cadastros, gerenciar membros/elegibilidade, regenerar escala.

## Arquitetura

```
Navegador (PWA)  ──HTTPS──►  Caddy  ──►  web  (Next.js 15)
                                  └──►  api  (Express + Socket.io + Prisma)
                                              ├─ db    (PostgreSQL)
                                              └─ minio (fotos, S3-compatível)
```

- **web/** — Next.js 15 (App Router), Tailwind, PWA. Mobile-first.
- **api/** — Express + Socket.io, Prisma, JWT (cookie httpOnly), argon2, node-cron.
- **Caddy** — reverse proxy com HTTPS automático (PWA exige HTTPS).

## Pré-requisitos

- Docker + Docker Compose
- (Para dev local sem Docker) Node 20+

## Subir com Docker (recomendado)

1. **Copie e configure o ambiente:**

   ```bash
   cp .env.example .env
   ```

   Edite o `.env` e defina senhas fortes (`POSTGRES_PASSWORD`, `JWT_SECRET`,
   `ADMIN_PASSWORD`, `MINIO_ROOT_PASSWORD`). Para `JWT_SECRET`:

   ```bash
   openssl rand -hex 32
   ```

2. **(Opcional, recomendado) Gere as chaves VAPID** para o push e cole no `.env`
   (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = mesma pública):

   ```bash
   cd api && npx web-push generate-vapid-keys
   ```

3. **Defina o domínio** em `APP_DOMAIN`:
   - Local: `APP_DOMAIN=localhost` (Caddy usa certificado interno; aceite o aviso do navegador).
   - Produção: seu domínio real apontando para o servidor (Caddy emite Let's Encrypt).

4. **Suba tudo:**

   ```bash
   docker compose up --build -d
   ```

5. Acesse **https://SEU_DOMINIO** (ou https://localhost). Entre com o admin do `.env`
   (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

> O container da API roda automaticamente `prisma migrate deploy` + seed do admin no boot.

## Como o rodízio funciona

- Elegíveis = usuários **ativos** marcados como **no rodízio**.
- A cada novo *round*, a ordem é embaralhada e distribuída de 2 em 2 nos próximos dias de
  café. Cada pessoa aparece **uma vez por round**. Se o nº for ímpar, a última pessoa faz
  café **solo** naquele dia, e então começa um novo round.
- Os dias de café são definidos em `COFFEE_WEEKDAYS` (padrão `1,2,3,4` = seg–qui).
- Um job diário (06:00, fuso `TZ`) fecha os dias passados, gera o próximo round quando
  necessário e dispara o push "sua vez". O admin pode **regenerar** a escala quando quiser.

## Desenvolvimento local (sem Docker)

Suba só o banco e o storage via Docker e rode web/api localmente:

```bash
# 1) Banco + MinIO
docker compose up -d db minio

# 2) API
cd api
cp ../.env.example .env   # ajuste DATABASE_URL p/ localhost:5432 e S3_ENDPOINT p/ localhost:9000
npm install
npx prisma migrate deploy && npm run seed
npm run dev                # http://localhost:4000

# 3) Web (outro terminal)
cd web
npm install
# crie web/.env.local com:
#   NEXT_PUBLIC_API_BASE=http://localhost:4000
#   NEXT_PUBLIC_VAPID_PUBLIC_KEY=<sua chave pública VAPID>
npm run dev                # http://localhost:3000
```

> Em dev cross-origin, deixe `CORS_ORIGIN=http://localhost:3000` no `.env` da API.
> Push e instalação PWA exigem HTTPS — para testar isso, use o setup com Caddy.

## Testes

```bash
cd api && npm test        # lógica do rodízio (duplas, sem repetição, caso ímpar, datas)
```

## Estrutura

```
versocafe/
├─ docker-compose.yml   # db, minio, api, web, caddy
├─ Caddyfile            # proxy + HTTPS
├─ .env.example
├─ api/                 # Express + Socket.io + Prisma
│  ├─ prisma/           # schema, migrations, seed
│  └─ src/
│     ├─ routes/        # auth, users, rotation, chat, uploads, push
│     ├─ services/      # rotationLogic (+testes), rotationService, storage, push
│     ├─ lib/           # prisma, jwt, password, dates
│     └─ middleware/    # auth (requireAuth/requireAdmin)
└─ web/                 # Next.js PWA
   ├─ public/           # manifest, sw.js, ícones
   └─ src/
      ├─ app/(app)/     # home, escala, chat, admin, perfil (autenticadas)
      ├─ app/login, app/register
      ├─ components/    # BottomNav, Avatar, Brand, PageHeader, ...
      └─ lib/           # api, auth, socket, push, format, types
```

## Variáveis de ambiente

Veja `.env.example` — todas documentadas. As principais: `APP_DOMAIN`, `DATABASE_URL`,
`JWT_SECRET`, `ADMIN_*`, `S3_*` (MinIO), `VAPID_*`, `COFFEE_WEEKDAYS`, `TZ`.
