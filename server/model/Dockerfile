FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04
ENV DEBIAN_FRONTEND=noninteractive PYTHONUNBUFFERED=1

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip libsndfile1 && \
    rm -rf /var/lib/apt/lists/*

# One torch wheel – the resolver will now bring in the tiny meta-wheels too
RUN pip install --no-cache-dir torch==2.3.0+cu121 \
      --extra-index-url https://download.pytorch.org/whl/cu121

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt     # no constraints file!

WORKDIR /app
COPY . .
CMD ["gunicorn","app.main:app","-k","uvicorn.workers.UvicornWorker","-b","0.0.0.0:8080"]
