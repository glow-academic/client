FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 PYTHONIOENCODING=utf8

# 0️⃣ system deps (tiny)
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip libsndfile1 && \
    rm -rf /var/lib/apt/lists/*

ARG TORCH_V=2.3.0          # change here if you upgrade CUDA/Torch

# 1️⃣ exactly one Torch wheel, no deps, no cache left behind
RUN pip install --no-deps --no-cache-dir \
        torch==${TORCH_V}+cu121 \
        --extra-index-url https://download.pytorch.org/whl/cu121

# 2️⃣ everything else, abiding by our constraints
COPY requirements.txt /tmp/
COPY constraints.txt  /tmp/
RUN pip install --no-cache-dir -r /tmp/requirements.txt -c /tmp/constraints.txt && \
    pip cache purge && rm -rf /tmp/*

WORKDIR /app
COPY . .
CMD ["gunicorn","app.main:app","-k","uvicorn.workers.UvicornWorker","-b","0.0.0.0:8080"]
