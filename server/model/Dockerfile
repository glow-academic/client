# syntax=docker/dockerfile:1.7

FROM python:3.11-slim
WORKDIR /app

# system libs for numpy + libsndfile --------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
        libsndfile1 libopenblas0-pthread libgomp1 ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# install Python deps -----------------------------------------
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && pip cache purge

# copy source last (keeps layer cache warm) -------------------
COPY . .

# Pre-download models during build to avoid runtime network issues
RUN python -c "\
from faster_whisper import WhisperModel; \
import urllib.request; \
from pathlib import Path; \
print('Downloading Whisper model...'); \
WhisperModel('tiny', device='cpu', compute_type='int8', download_root='/app/cache'); \
print('Downloading Kokoro models...'); \
cache_dir = Path('/app/cache'); \
cache_dir.mkdir(exist_ok=True); \
kokoro_model_path = cache_dir / 'kokoro-v1.0.onnx'; \
voices_path = cache_dir / 'voices-v1.0.bin'; \
urllib.request.urlretrieve('https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx', kokoro_model_path) if not kokoro_model_path.exists() else None; \
urllib.request.urlretrieve('https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin', voices_path) if not voices_path.exists() else None; \
print('Models downloaded successfully')"

# let the app know it lives in Docker (your code already checks this)
ENV DOCKER_ENV=1

# simple uvicorn - no threading complexity with AI models
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
    