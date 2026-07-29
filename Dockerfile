FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md config.yaml ./
COPY trading_agent ./trading_agent

RUN pip install --no-cache-dir .

ENV PYTHONUNBUFFERED=1

CMD ["trade-agent", "run", "--cycles", "1"]
