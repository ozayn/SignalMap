FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY start.sh .
RUN chmod +x start.sh

ENV PORT=8080
EXPOSE 8080

CMD ["./start.sh"]
