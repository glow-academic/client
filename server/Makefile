.PHONY: venv dev-tools sync format lint typecheck run prod generate-models

# Check if venv exists
VENV_EXISTS := $(shell test -d .venv && echo 1 || echo 0)

# 1. Ensure the virtual environment exists
venv:
	@if [ $(VENV_EXISTS) -eq 0 ]; then uv venv; fi

# 2. Install development tools into the venv
dev-tools: venv
	@uv pip install --upgrade pip
	@uv pip install uv

# 3. Sync runtime dependencies
sync: dev-tools
	@uv pip install -r requirements.txt -r model/requirements.txt

# 4. Format code with Ruff and auto-fix issues
format: venv
	@uvx ruff format
	@uvx ruff check --fix

# 5. Run linter checks
lint: venv
	@echo "Running linter..."
	@uvx ruff check .

# 6. Run MyPy for static type checking
typecheck: venv
	@echo "Type checking..."
	@uv run mypy app --config-file mypy.ini

# Generate SQLModel classes from database schema
generate-models: venv
	@echo "Generating SQLModel classes from database schema..."
	@uv run python scripts/generate_models.py

# Generate pytest tests for routes and services
generate-tests: venv
	@echo "Generating pytest tests..."
	@uv run python scripts/generate_pytest_tests.py

# Run all tests
test: sync generate-tests
	@echo "Running pytest tests..."
	@uv run pytest tests/ -v

# Run tests with coverage
test-cov: sync generate-tests
	@echo "Running pytest tests with coverage..."
	@uv run pytest tests/ --cov=app --cov-report=term-missing --cov-report=html

# Run specific test file
test-file: sync
	@echo "Running specific test file: $(FILE)"
	@uv run pytest $(FILE) -v

# 9. Start FastAPI via Uvicorn
# ---------- local run helpers ----------
run-model: sync
	@echo "⇢ starting model service on :8080"
	@uv run uvicorn model.app.main:app --reload --host 0.0.0.0 --port 8080

run-server: sync generate-models generate-tests
	@echo "⇢ starting API  server on :8000"
	@uv run uvicorn app.main:app   --reload --host 0.0.0.0 --port 8000

# one-shot: start both and keep the foreground alive
run:                                        \
	(run-model &) &&                         \
	(run-server &) &&                       \
	wait

# 10. Start FastAPI via Gunicorn+Uvicorn for production
prod: sync
	@echo "Starting FastAPI server in production mode..."
	@uv run gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
