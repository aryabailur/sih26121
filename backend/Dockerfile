# NWIS API — one container for any Docker host (Render, Railway, Koyeb, or a VM inside OIL's network).
#
#   docker build -t nwis-api backend
#   docker run -p 8000:8000 nwis-api          # → http://localhost:8000/api/health
#
# The host's $PORT is honoured (Render sets it); 8000 otherwise.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Tesseract reads the image-only sample report (OCR demo)
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .

# Bake the demo knowledge base and the real-data scan into the image: a cold start then skips seeding and the
# 1,970-history extraction (~30 s at 0.1 CPU) — it only builds the search index and fits the learned cross-check.
# Every restart begins from this clean demo state.
RUN python seed_data.py \
    && python -c "from services.opendata import precompute; print('real-data scan cached:', precompute())" \
    && chmod -R a+rwX data

EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
