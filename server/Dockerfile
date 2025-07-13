# syntax=docker/dockerfile:1.7
# server/Dockerfile - Optimized multi-stage build

#####################################
# 1️⃣  Build Python wheels once
#####################################
FROM python:3.11-slim AS deps
WORKDIR /install

# Only what pip needs to compile native modules (if any)
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends build-essential gcc && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements for dependency installation
COPY requirements.txt .

# Leverage BuildKit cache so unchanged deps are instant
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && \
    pip install --prefer-binary --prefix=/install \
      -r requirements.txt

#####################################
# 2️⃣  Runtime image
#####################################
FROM python:3.11-slim AS runtime
WORKDIR /app

# Runtime-only
# Cache APT index & downloaded .debs for faster rebuilds
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates espeak-ng && \
    rm -rf /var/lib/apt/lists/*

# Copy the pre-built Python deps — no `pip install` here
COPY --from=deps /install /usr/local

# # Download the SpaCy model needed by Kokoro
# RUN python -m spacy download en_core_web_sm

# Run unit tests as part of the build process
COPY requirements.txt .
COPY tests/ tests/
RUN echo "🧪 Running server unit tests..." && \
    python -m pytest tests/ -v --tb=short

# Copy application source last (better layer cache)
COPY . .

# Create non-root user
RUN groupadd --system --gid 1001 appuser && \
    useradd --system --uid 1001 --gid appuser --create-home appuser

# Create uploads directory and set permissions
RUN mkdir -p /app/uploads/tus_uploads && \
    chown -R appuser:appuser /app
USER appuser

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Expose port
EXPOSE 8000

# Start the application
CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", \
     "-b", "0.0.0.0:8000", "--log-level", "info"]