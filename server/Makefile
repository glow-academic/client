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
	@uv pip install -r requirements.txt

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
	@uv run mypy app/

# Generate SQLModel classes from database schema
generate-models: venv
	@echo "Generating SQLModel classes from database schema..."
	@uv run python scripts/generate_models.py

# 9. Start FastAPI via Uvicorn
run: sync generate-models
	@echo "Starting FastAPI server..."
	@uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 10. Start FastAPI via Gunicorn+Uvicorn for production
prod: sync
	@echo "Starting FastAPI server in production mode..."
	@uv run gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
