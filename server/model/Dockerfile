# ---------- Build stage ----------
FROM pytorch/pytorch:2.3.0-cuda12.1-cudnn8-runtime AS builder
WORKDIR /app

# Bare-minimum OS deps
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential git && \
    rm -rf /var/lib/apt/lists/*

# Pin versions → reproducible, deterministic startups
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ---------- Runtime stage ----------
FROM pytorch/pytorch:2.3.0-cuda12.1-cudnn8-runtime AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf8 \
    # Let PyTorch use all visible GPUs without OOM-ing
    TORCH_CUDA_ALLOC_CONF=max_split_size_mb:64,garbage_collection_threshold:0.6 \
    # Faster CPU inference fall-back
    OMP_NUM_THREADS=1

WORKDIR /app
COPY --from=builder /opt/conda /opt/conda
COPY . .

# Non-root for safety
RUN groupadd -r app && useradd -r -g app app
USER app

EXPOSE 8080
CMD ["gunicorn", "app.main:app", "-k", "uvicorn.workers.UvicornWorker", \
     "-w", "1", "--threads", "8", "-b", "0.0.0.0:8080", "--log-level", "info"]
    