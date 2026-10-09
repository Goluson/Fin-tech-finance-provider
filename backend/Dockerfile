# syntax=docker/dockerfile:1
FROM python:3.12-slim

WORKDIR /app

# System deps for asyncpg / psycopg builds
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY schema.sql .

# Cloud Run provides $PORT; default to 8080 for local runs.
ENV PORT=8080
EXPOSE 8080

CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 2
