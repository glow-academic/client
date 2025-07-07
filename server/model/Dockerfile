# syntax=docker/dockerfile:1.7

# -------- build stage --------
FROM python:3.11-slim AS builder
WORKDIR /app

# system libs for numpy + libsndfile --------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
        libsndfile1 libopenblas0-pthread libgomp1 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# install Python deps -----------------------------------------
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && pip cache purge

# copy source last (keeps layer cache warm) -------------------
COPY . .

# -------- runtime stage (distroless) --------
FROM gcr.io/distroless/python3-debian12
WORKDIR /app
COPY --from=builder /usr/local /usr/local
COPY --from=builder /app /app

# let the app know it lives in Docker (your code already checks this)
ENV DOCKER_ENV=1

# simple & small: uvicorn only
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
    