FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    INSIDER_HOST=0.0.0.0 \
    INSIDER_PORT=8080

COPY pyproject.toml README.md ./
COPY sec_insider_scout ./sec_insider_scout

RUN pip install --no-cache-dir .

EXPOSE 8080

CMD ["insider-scout", "serve", "--host", "0.0.0.0", "--port", "8080"]
