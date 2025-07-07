# ---------- 1️⃣  Builder ----------
# 👇 Smallest NVIDIA image that still brings libcuda
FROM python:3.10-slim-bookworm AS builder
ARG TORCH_V=2.3.0+cu121
ARG TORCH_URL=https://download.pytorch.org/whl/cu121

WORKDIR /wheels

# Compile-time tools only here
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Freeze deps ➜ /wheels
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip wheel \
 && pip wheel --no-cache-dir -r requirements.txt \
 && pip wheel --no-cache-dir torch=="${TORCH_V}" --extra-index-url "${TORCH_URL}"

# ---------- 2️⃣  Runtime ----------
FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04 AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf8 \
    TORCH_CUDA_ALLOC_CONF=max_split_size_mb:64,garbage_collection_threshold:0.6 \
    OMP_NUM_THREADS=1

# Slim system deps for runtime only
RUN apt-get update \
 && apt-get install -y --no-install-recommends libsndfile1 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install wheels quickly, no compiler needed
COPY --from=builder /wheels /wheels
RUN python -m venv /venv \
 && . /venv/bin/activate \
 && pip install --no-index --find-links=/wheels /wheels/*.whl \
 && rm -rf /wheels

ENV PATH="/venv/bin:${PATH}"

# Copy source *after* deps so rebuilds stay fast
COPY . .

# Non-root for safety
RUN groupadd -r app && useradd -r -g app app
USER app

EXPOSE 8080
CMD ["gunicorn", "app.main:app", "-k", "uvicorn.workers.UvicornWorker", "-w", "1", "--threads", "8", "-b", "0.0.0.0:8080", "--log-level", "info"]
