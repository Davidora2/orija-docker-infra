FROM python:3.12-slim

WORKDIR /app

COPY shared /opt/shared
RUN pip install --no-cache-dir /opt/shared

COPY services/rules-engine/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY services/rules-engine/worker.py /app/worker.py

ENV PYTHONUNBUFFERED=1

CMD ["python", "worker.py"]
