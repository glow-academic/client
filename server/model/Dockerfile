FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04
ENV DEBIAN_FRONTEND=noninteractive

ENV PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf8 \
    TORCH_CUDA_ALLOC_CONF=max_split_size_mb:64,garbage_collection_threshold:0.6 \
    OMP_NUM_THREADS=1

# 1. Add compiler only long enough to build wheels
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 python3-pip python3-venv \
        build-essential git libsndfile1 ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .

# 2. Install directly, delete wheel cache and build tools in the same layer
RUN --mount=type=cache,target=/root/.cache/pip \
    python3 -m pip install --upgrade pip && \
    python3 -m pip install --no-cache-dir \
        torch==2.3.0+cu121 -f https://download.pytorch.org/whl/cu121 && \
    python3 -m pip install --no-cache-dir -r requirements.txt && \
    apt-get purge -y build-essential git && \
    apt-get autoremove -y && \
    rm -rf /root/.cache/pip

ENV PATH="/usr/local/bin:${PATH}"

# Copy source *after* deps so rebuilds stay fast
COPY . .

# Non-root for safety
RUN groupadd -r app && useradd -r -g app app
USER app

EXPOSE 8080
CMD ["gunicorn", "app.main:app", "-k", "uvicorn.workers.UvicornWorker", "-w", "1", "--threads", "8", "-b", "0.0.0.0:8080", "--log-level", "info"]
