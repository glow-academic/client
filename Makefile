.PHONY: dev build start lint typecheck format setup clean help sync-types test-e2e test-e2e-ui
.PHONY: docker-build docker-run up down logs
.PHONY: detect-env deploy-target switch-traffic monitor

# ── Configuration ──────────────────────────────────────────
NODE_BIN   = node_modules/.bin
PORT       ?= 3000
ENV        ?= green
API_URL    ?= http://localhost:8000

# ── Development ────────────────────────────────────────────
setup: ## Install dependencies
	bun install

dev: ## Start dev server
	bun dev

build: ## Production build
	NODE_ENV=production bun run build

start: ## Start production server
	bun start

# ── Code Quality ───────────────────────────────────────────
lint: ## Run ESLint
	bun run lint

lint-fix: ## Fix ESLint issues
	bun run lint:fix

typecheck: ## TypeScript type check
	bun run typecheck

test-e2e: ## Run Playwright E2E tests
	bun run test:e2e

test-e2e-ui: ## Open Playwright UI mode
	bun run test:e2e:ui

# Recording demos is now native to the CLI: `glow record client <workflow>`
# drives the deployed client with the host's Playwright. See glow-academic-cli.

format: ## Format code with Prettier
	bun run format

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

# ── Type Generation ────────────────────────────────────────
sync-types: ## Fetch OpenAPI schema from server and regenerate TypeScript types
	@echo "Fetching OpenAPI schema from $(API_URL)..."
	@curl -sf $(API_URL)/openapi.json -o /tmp/glow-openapi.json
	@echo "{\"glow-api\":{\"version\":\"$$(jq -r '.info.version' /tmp/glow-openapi.json)\",\"synced_at\":\"$$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}}" | jq . > api-versions.json
	@bun x openapi-typescript /tmp/glow-openapi.json -o lib/api/schema.ts
	@rm -f /tmp/glow-openapi.json
	@echo "✅ Types updated: lib/api/schema.ts"

# ── Cleanup ────────────────────────────────────────────────
clean: ## Remove build artifacts
	rm -rf .next node_modules test-results playwright-report demo-output

# ── Help ───────────────────────────────────────────────────
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
