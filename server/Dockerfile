# server/Dockerfile

FROM python:3.11-slim
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Install development dependencies for testing, linting, and type checking
RUN pip install pytest pytest-asyncio respx coverage ruff mypy

# Run linter checks
RUN echo "Running linter..." && ruff check .

# Run type checking
RUN echo "Type checking..." && mypy app/

# Run tests before deployment
RUN echo "Running tests..." && pytest -q --disable-warnings

# Generate models if needed
RUN python scripts/generate_models.py

# Expose the FastAPI port
EXPOSE 8000

# Start Uvicorn server with the correct module path
CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000"]
