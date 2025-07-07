FROM pytorch/pytorch:2.3.0-py3.10-cu121-ubuntu22.04

RUN apt-get update && apt-get install -y --no-install-recommends libsndfile1 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
CMD ["gunicorn","app.main:app","-k","uvicorn.workers.UvicornWorker", "-b","0.0.0.0:8080"]
