.PHONY: venv dev-tools sync format lint typecheck run prod generate-models clean-venv

# Check if venv exists
VENV_EXISTS := $(shell test -d .venv && echo 1 || echo 0)

ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))

# 1. Ensure the virtual environment exists
PY311 := $(shell which python3.11 || true)

venv:
	@if [ $(VENV_EXISTS) -eq 0 ]; then \
		if [ -z "$(PY311)" ]; then \
			echo "❌  python3.11 not found - install it or adjust PY311"; exit 1; \
		fi; \
		echo "Creating virtual environment with Python 3.11: $(PY311)"; \
		uv venv -p $(PY311); \
	fi

# Clean and recreate virtual environment with Python 3.11
clean-venv:
	@echo "Cleaning existing virtual environment..."
	@rm -rf .venv
	@echo "Creating new virtual environment with Python 3.11..."
	@uv venv -p $(PY311)

# 2. Install development tools into the venv
dev-tools: venv
	@uv pip install --upgrade pip --python .venv/bin/python
	@uv pip install uv --python .venv/bin/python

# 3. Sync runtime dependencies
sync: dev-tools
	@echo "Installing dependencies with Python 3.11..."
	@uv pip install -r requirements.txt -r requirements-dev.txt --python .venv/bin/python

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
	@.venv/bin/python -m mypy app --config-file mypy.ini

# Generate SQLModel classes from database schema
generate-models: venv
	@echo "Generating SQLModel classes from database schema..."
	@.venv/bin/python scripts/generate_models.py

# Generate pytest tests for routes and services
generate-tests: venv
	@echo "Generating pytest tests..."
	@.venv/bin/python scripts/generate_pytest_tests.py

# Run all tests
test: sync generate-tests
	@if [ -n "$(ARGS)" ]; then \
		echo "Running pytest on specific file(s): $(ARGS)"; \
		.venv/bin/python -m pytest $(ARGS) -v; \
	else \
		echo "Running all pytest tests..."; \
		.venv/bin/python -m pytest tests/ -v; \
	fi

# Run tests with coverage
test-cov: sync generate-tests
	@echo "Running pytest tests with coverage..."
	@.venv/bin/python -m pytest tests/ --cov=app --cov-report=term-missing --cov-report=html


run: sync generate-models generate-tests
	@echo "⇢ starting API  server on :8000"
	@.venv/bin/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000


# convenience
stop:
	@if [ -f .model.pid ]; then kill `cat .model.pid` || true; rm .model.pid; fi

# 10. Start FastAPI via Gunicorn+Uvicorn for production
prod: sync
	@echo "Starting FastAPI server in production mode..."
	@.venv/bin/python -m gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
