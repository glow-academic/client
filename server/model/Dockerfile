# -------- SMALL, SINGLE STAGE --------
FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04
ENV DEBIAN_FRONTEND=noninteractive

# 0️⃣  Minimal system + Python
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 python3-pip python3-venv libsndfile1 && \
    rm -rf /var/lib/apt/lists/*

# 1️⃣  Create isolated env so we can nuke pip cache safely
RUN python3 -m venv /venv && /venv/bin/pip install --upgrade pip
ENV PATH="/venv/bin:${PATH}" \
    PYTHONUNBUFFERED=1 PYTHONIOENCODING=utf8 \
    TORCH_CUDA_ALLOC_CONF=max_split_size_mb:64,garbage_collection_threshold:0.6 \
    OMP_NUM_THREADS=1

# 2️⃣  Install GPU Torch once, then purge cache
ARG TORCH_V=2.3.0          # change here if you need newer
RUN pip install --no-cache-dir torch==$TORCH_V \
        --index-url https://download.pytorch.org/whl/cu121 && \
    pip cache purge

# 3️⃣  Copy reqs and install **without pulling another Torch**
COPY requirements.txt /tmp/requirements.txt
RUN echo "torch==$TORCH_V" >> /tmp/constraints.txt && \
    pip install --no-cache-dir -r /tmp/requirements.txt \
        -c /tmp/constraints.txt && \
    pip cache purge

# 4️⃣  Copy app after deps so code-only edits stay fast
WORKDIR /app
COPY . .

# 5️⃣  Drop privileges
RUN groupadd -r app && useradd -r -g app app
USER app

EXPOSE 8080
CMD ["gunicorn","app.main:app","-k","uvicorn.workers.UvicornWorker", "-w","1","--threads","8","-b","0.0.0.0:8080","--log-level","info"]
    