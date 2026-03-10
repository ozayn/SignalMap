FROM python:3.11-slim

WORKDIR /app

# Install torch CPU first (avoids ~2.5GB CUDA deps; Railway has no GPU)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    --extra-index-url https://download.pytorch.org/whl/cpu

COPY main.py run.py db.py jobs.py cron_daily_update.py .
COPY connectors/ ./connectors/
COPY src/ ./src/

EXPOSE 8080

CMD ["python", "run.py"]
