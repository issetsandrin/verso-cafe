# ☕ VersoCafé — atalhos para subir e operar o projeto.
# Rode `make` ou `make help` para ver todos os comandos.

# Usa docker compose v2 (plugin). Sobrescreva com: make COMPOSE="docker-compose" ...
COMPOSE ?= docker compose

# Porta pública do app (lida do .env; cai para 8088 se ausente).
APP_PORT := $(shell sed -n 's/^APP_PORT=//p' .env 2>/dev/null)
APP_PORT := $(or $(APP_PORT),8088)
URL := http://localhost:$(APP_PORT)

.DEFAULT_GOAL := help

# ---------------------------------------------------------------------------
# Ajuda
# ---------------------------------------------------------------------------
.PHONY: help
help: ## Mostra esta ajuda
	@echo "☕ VersoCafé — comandos disponíveis:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Início rápido:  make up    →  acesse $(URL)"

# ---------------------------------------------------------------------------
# Ambiente
# ---------------------------------------------------------------------------
.env: ## Cria o .env a partir do .env.example (se ainda não existir)
	@test -f .env || { cp .env.example .env; \
		echo "✅ .env criado a partir do .env.example — edite os segredos antes de subir!"; }

.PHONY: setup
setup: .env ## Prepara o ambiente (gera .env; lembra de configurar segredos)
	@echo "➡️  Revise o .env: POSTGRES_PASSWORD, JWT_SECRET, ADMIN_PASSWORD, MINIO_ROOT_PASSWORD."
	@echo "   Gere um JWT_SECRET com:  make secret"
	@echo "   Gere chaves de push com: make vapid"

.PHONY: secret
secret: ## Gera um segredo forte (para JWT_SECRET)
	@openssl rand -hex 32

.PHONY: vapid
vapid: ## Gera o par de chaves VAPID (web push)
	@cd api && npx --yes web-push generate-vapid-keys

# ---------------------------------------------------------------------------
# Docker — subir o projeto completo
# ---------------------------------------------------------------------------
.PHONY: up
up: .env ## Sobe tudo (build + db, minio, api, web, caddy) em background
	$(COMPOSE) up --build -d
	@echo ""
	@echo "✅ VersoCafé no ar! Acesse: $(URL)"
	@echo "   Login admin: veja ADMIN_EMAIL / ADMIN_PASSWORD no .env"
	@echo "   Logs:  make logs    |   Status:  make ps"

.PHONY: build
build: .env ## Apenas constrói as imagens (sem subir)
	$(COMPOSE) build

.PHONY: rebuild
rebuild: .env ## Reconstrói as imagens sem cache e sobe
	$(COMPOSE) build --no-cache
	$(COMPOSE) up -d

.PHONY: down
down: ## Derruba os containers (mantém os dados/volumes)
	$(COMPOSE) down

.PHONY: restart
restart: ## Reinicia os containers
	$(COMPOSE) restart

.PHONY: stop
stop: ## Para os containers sem removê-los
	$(COMPOSE) stop

.PHONY: ps
ps: ## Mostra o status dos serviços
	$(COMPOSE) ps

.PHONY: logs
logs: ## Acompanha os logs de todos os serviços (Ctrl+C para sair)
	$(COMPOSE) logs -f --tail=100

.PHONY: logs-api
logs-api: ## Acompanha apenas os logs da API
	$(COMPOSE) logs -f --tail=100 api

# ---------------------------------------------------------------------------
# Banco de dados / Prisma (dentro do container da API)
# ---------------------------------------------------------------------------
.PHONY: migrate
migrate: ## Aplica as migrations no banco (prisma migrate deploy)
	$(COMPOSE) exec api npx prisma migrate deploy

.PHONY: seed
seed: ## Roda o seed (garante o usuário admin)
	$(COMPOSE) exec api npm run seed

.PHONY: db-shell
db-shell: ## Abre um psql no banco
	$(COMPOSE) exec db sh -c 'psql -U $$POSTGRES_USER -d $$POSTGRES_DB'

.PHONY: api-shell
api-shell: ## Abre um shell no container da API
	$(COMPOSE) exec api sh

# ---------------------------------------------------------------------------
# Desenvolvimento local (web/api fora do Docker; só infra no Docker)
# ---------------------------------------------------------------------------
.PHONY: install
install: ## Instala as dependências de api/ e web/
	cd api && npm install
	cd web && npm install

.PHONY: dev-infra
dev-infra: .env ## Sobe só o banco + MinIO (para rodar api/web localmente)
	$(COMPOSE) up -d db minio
	@echo "✅ db (5432) e minio (9000/9001) no ar. Rode 'make dev-api' e 'make dev-web'."

.PHONY: dev-api
dev-api: ## Roda a API em modo dev local (http://localhost:4000)
	cd api && npm run dev

.PHONY: dev-web
dev-web: ## Roda o frontend em modo dev local (http://localhost:3000)
	cd web && npm run dev

# ---------------------------------------------------------------------------
# Qualidade
# ---------------------------------------------------------------------------
.PHONY: test
test: ## Roda os testes da API (lógica do rodízio)
	cd api && npm test

.PHONY: typecheck
typecheck: ## Checagem de tipos da API
	cd api && npm run typecheck

# ---------------------------------------------------------------------------
# Limpeza
# ---------------------------------------------------------------------------
.PHONY: clean
clean: ## Derruba tudo E APAGA os volumes (banco, fotos, certificados!)
	@printf "⚠️  Isso vai APAGAR o banco, as fotos e os dados. Continuar? [y/N] "; \
	read ans; [ "$$ans" = "y" ] || [ "$$ans" = "Y" ] || { echo "cancelado."; exit 1; }
	$(COMPOSE) down -v

.PHONY: prune
prune: ## Remove imagens órfãs do projeto (libera espaço)
	$(COMPOSE) down --rmi local --remove-orphans
