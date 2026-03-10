FROM python:3.11-slim

WORKDIR /app

# Build deps for hdbscan (compiles C extensions)
RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install torch CPU first (avoids ~2.5GB CUDA deps; Railway has no GPU)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py run.py db.py jobs.py cron_daily_update.py .
COPY connectors/ ./connectors/
COPY src/ ./src/

EXPOSE 8080

CMD ["python", "run.py"]
