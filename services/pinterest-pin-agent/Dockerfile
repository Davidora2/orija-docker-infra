FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src ./src
COPY config ./config
COPY scripts ./scripts

ENV PYTHONPATH=/app/src
ENV DATA_DIR=/data
ENV CONFIG_DIR=/app/config

VOLUME ["/data"]

# Default: long-running scheduler (~1 pin every PIN_INTERVAL_HOURS)
CMD ["python", "-m", "pin_agent", "schedule"]
