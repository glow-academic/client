# server/Dockerfile

FROM python:3.11-slim
WORKDIR /app

# Install dependencies (includes all dev dependencies from requirements.txt)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# # Run linter checks
# RUN echo "Running linter..." && ruff check .

# # Run type checking
# RUN echo "Type checking..." && mypy app/

# # Run tests before deployment
# RUN echo "Running tests..." && pytest -q --disable-warnings

# Generate models at runtime instead of build time
EXPOSE 8000

# Modified CMD to generate models before starting the server
ENV PYTHONUNBUFFERED=1
CMD ["sh","-c","python -u scripts/generate_models.py && \
    gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker \
    --access-logfile - --error-logfile - \
    -b 0.0.0.0:8000"]
