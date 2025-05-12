.PHONY: venv dev-tools sync format lint typecheck tests coverage run

# 1. Ensure the virtual environment exists
venv:
	@uv venv

# 2. Install development tools into the venv
dev-tools: venv
	@uv pip install --upgrade pip
	@uv pip install uv ruff mypy pytest pytest-asyncio respx coverage

# 3. Sync runtime dependencies
sync: dev-tools
	@uv pip install -r requirements.txt

# 4. Format code with Ruff and auto-fix issues
format: dev-tools
	@uvx ruff format
	@uvx ruff check --fix

# 5. Run linter checks
lint: dev-tools
	@echo "Running linter..."
	@uvx ruff check .

# 6. Run MyPy for static type checking
typecheck: dev-tools
	@echo "Type checking..."
	@uv run mypy app/

# 7. Run pytest, with RESPX for HTTPX mocking
tests: dev-tools
	@echo "Running tests..."
	@uvx pytest -q --disable-warnings

# 8. Generate coverage report (fail if <75% covered)
coverage: dev-tools
	@echo "Generating coverage report..."
	@uvx coverage run -m pytest -q
	@uvx coverage xml -o coverage.xml
	@uvx coverage report -m --fail-under=75

# 9. Start FastAPI via Uvicorn
run: sync
	@echo "Starting FastAPI server..."
	@uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
