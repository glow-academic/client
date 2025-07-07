# syntax=docker/dockerfile:1.6
ARG DEVICE=cpu
ARG PYTAG=py3.10

FROM pytorch/pytorch:2.3.1-${DEVICE}-${PYTAG} AS base

# --------------------------------------------------------
WORKDIR /app

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt \
 && pip cache purge

# your source last (keeps rebuilds fast)
COPY . .

# default to GPU, but honour the ASR_DEVICE env at run time
ENV ASR_DEVICE=auto

CMD ["gunicorn", "app.main:app", "-k", "uvicorn.workers.UvicornWorker", "-w", "1", "--threads", "8", "-b", "0.0.0.0:8080", "--log-level", "info"]
