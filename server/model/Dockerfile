# ---- CUDA 12.1, cuDNN 8, PyTorch 2.3.1 (runtime-only) ----
FROM pytorch/pytorch:2.3.1-cuda12.1-cudnn8-runtime

WORKDIR /app
COPY requirements.txt .

# install ONLY what we really need, no cache left behind
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip cache purge

# your source last (keeps the cache hot on rebuilds)
COPY . .

CMD ["gunicorn", "app.main:app", "-k", "uvicorn.workers.UvicornWorker", "-w", "1", "--threads", "8", "-b", "0.0.0.0:8080", "--log-level", "info"]
    