# server/Dockerfile
FROM python:3.11-slim
WORKDIR /app

# 1 – install Python deps first so the TeX layer is cached separately
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 2 – bring in TeX Live *and* the Latin-Modern fonts & macros
RUN apt-get update && apt-get install -y \
    texlive-latex-base \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    fonts-lmodern \
 && rm -rf /var/lib/apt/lists/*

# 3 – copy your code
COPY . .

EXPOSE 8000
ENV PYTHONUNBUFFERED=1
CMD ["sh","-c","python scripts/generate_models.py && \
     gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker \
     -b 0.0.0.0:8000 --log-level info"]