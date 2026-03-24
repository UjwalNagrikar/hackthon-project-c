FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

COPY app-layer/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app-layer/app.py .
COPY static /app/static

RUN mkdir -p /app/data

EXPOSE 5000

CMD ["python", "app.py"]