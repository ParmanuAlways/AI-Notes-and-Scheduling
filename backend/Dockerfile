# Backend image — FastAPI + uvicorn
FROM python:3.11-slim

WORKDIR /app

# System libs. libgomp1 is the OpenMP runtime that ctranslate2 / onnxruntime —
# the engines behind faster-whisper — load at import time; without it the
# Whisper import fails and voice transcription reports "unavailable" on the
# slim base. Kept minimal (audio decoding uses PyAV's bundled ffmpeg).
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first (better layer caching)
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY backend/ ./

EXPOSE 9000

# DB host/credentials come from docker-compose environment (override .env).
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "9000"]
