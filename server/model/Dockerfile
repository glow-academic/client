########################  🔨  Builder  ########################
FROM python:3.10-slim-bookworm AS builder
WORKDIR /wheels

# Build tools only in this throw-away stage
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential git ca-certificates libsndfile1 && \
    rm -rf /var/lib/apt/lists/*

# Freeze Python deps into wheels
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip wheel && \
    pip wheel torch==2.3.0 --index-url https://download.pytorch.org/whl/cu121 && \
    pip wheel -r requirements.txt

########################  🚀  Runtime  ########################
FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04

# Copy the minimal Python runtime (≈55 MB) produced by the builder
COPY --from=builder /usr/local /usr/local
ENV PATH="/usr/local/bin:${PATH}" \
    PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf8 \
    TORCH_CUDA_ALLOC_CONF=max_split_size_mb:64,garbage_collection_threshold:0.6 \
    OMP_NUM_THREADS=1

# Only runtime libs; no compilers, no git
RUN apt-get update && \
    apt-get install -y --no-install-recommends libsndfile1 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

# Drop privileges
RUN groupadd -r app && useradd -r -g app app
USER app

EXPOSE 8080
CMD ["gunicorn", "app.main:app", "-k", "uvicorn.workers.UvicornWorker", "-w", "1", "--threads", "8", "-b", "0.0.0.0:8080", "--log-level", "info"]
