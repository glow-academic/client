# PyTorch 2.3 RELEASE + CUDA 12.1, already built for *runtime* use
FROM pytorch/pytorch:2.3.1-cuda12.1-cudnn8-runtime

WORKDIR /app

# ---- Python deps ----
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ---- your code ----
COPY . .

# gunicorn (or whatever entrypoint you prefer)
CMD ["gunicorn", "app.main:app", "-k", "uvicorn.workers.UvicornWorker", "-w", "1", "--threads", "8", "-b", "0.0.0.0:8080", "--log-level", "info"]