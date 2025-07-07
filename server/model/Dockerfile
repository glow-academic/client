FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip libsndfile1 && \
    rm -rf /var/lib/apt/lists/*            # clean APT cache

ENV PYTHONUNBUFFERED=1 PYTHONIOENCODING=utf8 \
    TORCH_CUDA_ALLOC_CONF=max_split_size_mb:64,garbage_collection_threshold:0.6 \
    OMP_NUM_THREADS=1
ARG TORCH_V=2.3.0

# ① one Torch wheel, **no deps**
RUN pip install --no-cache-dir --no-deps torch==$TORCH_V \
        --index-url https://download.pytorch.org/whl/cu121 && \
    pip cache purge                        # remove wheel cache

# ② everything else, but forbid extra CUDA wheels
COPY requirements.txt /tmp/requirements.txt
COPY skip_cuda.txt       /tmp/skip_cuda.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt \
        -c /tmp/skip_cuda.txt && \
    pip cache purge && rm -rf /tmp/*

WORKDIR /app
COPY . .

RUN groupadd -r app && useradd -r -g app app
USER app
EXPOSE 8080
CMD ["gunicorn","app.main:app","-k","uvicorn.workers.UvicornWorker", "-w","1","--threads","8","-b","0.0.0.0:8080","--log-level","info"]
