# server/Dockerfile

# ——— Base Stage ———
FROM python:3.11-slim AS base
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# ——— Production Build Stage ———
FROM base AS build

# Install TeX Live and document processing tools for production
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    fonts-lmodern \
    libreoffice-core \
    libreoffice-writer \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Run unit tests as part of the build process
RUN echo "🧪 Running server unit tests..." && \
    python -m pytest tests/ -v --tb=short

# ——— Production Runtime Stage ———
FROM python:3.11-slim AS production

WORKDIR /app

# Install runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    fonts-lmodern \
    libreoffice-core \
    libreoffice-writer \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application from build stage
COPY --from=build /app .

# Create a non-root user
RUN groupadd --system --gid 1001 appuser && \
    useradd --system --uid 1001 --gid appuser --create-home appuser

# Change ownership of the app directory
RUN chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Start the application
CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", \
     "-b", "0.0.0.0:8000", "--log-level", "info"]