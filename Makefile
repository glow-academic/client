.PHONY: dev build start lint typecheck format setup clean help
.PHONY: docker-build docker-run up down logs
.PHONY: detect-env deploy-target switch-traffic monitor

# ── Configuration ──────────────────────────────────────────
NODE_BIN   = node_modules/.bin
PORT       ?= 3000
ENV        ?= green

# ── Development ────────────────────────────────────────────
setup: ## Install dependencies
	yarn install

dev: ## Start dev server
	yarn dev

build: ## Production build
	NODE_ENV=production yarn build

start: ## Start production server
	yarn start

# ── Code Quality ───────────────────────────────────────────
lint: ## Run ESLint
	yarn lint

lint-fix: ## Fix ESLint issues
	yarn lint:fix

typecheck: ## TypeScript type check
	yarn typecheck

format: ## Format code with Prettier
	yarn format

# ── Docker ─────────────────────────────────────────────────
docker-build: ## Build Docker image
	docker build -t glow-client .

docker-run: docker-build ## Run Docker container
	docker run -p $(PORT):3000 --env-file .env.local glow-client

up: ## Start docker compose stack
	docker compose up -d

down: ## Stop docker compose stack
	docker compose down

logs: ## Tail docker compose logs
	docker compose logs -f

# ── Deployment (Blue-Green) ───────────────────────────────
detect-env: ## Show active/target environment
	@bash scripts/detect-env.sh

deploy-target: ## Deploy target env (ENV=blue|green)
	bash scripts/deploy-target.sh $(ENV)

switch-traffic: ## Switch traffic to env (ENV=blue|green)
	bash scripts/switch-traffic.sh $(ENV)

monitor: ## Monitor deployment (ENV=blue|green ROLLBACK=blue|green)
	bash scripts/monitor.sh $(ENV) $(ROLLBACK) 45

# ── Cleanup ────────────────────────────────────────────────
clean: ## Remove build artifacts
	rm -rf .next node_modules

# ── Help ───────────────────────────────────────────────────
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
