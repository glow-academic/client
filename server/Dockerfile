# server/Dockerfile
FROM python:3.11-slim
WORKDIR /app

# Install dependencies (includes all dev dependencies from requirements.txt)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Install TeX dependencies for PyLaTeX
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    && rm -rf /var/lib/apt/lists/*

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
CMD ["sh", "-c", "python scripts/generate_models.py && gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 --log-level info"]