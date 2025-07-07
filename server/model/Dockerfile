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

# let the app know it lives in Docker (your code already checks this)
ENV DOCKER_ENV=1

# use gunicorn for better production performance
CMD ["gunicorn", "app.main:app", "-k", "uvicorn.workers.UvicornWorker", "-w", "1", "--threads", "8", "-b", "0.0.0.0:8080", "--log-level", "info"]
    