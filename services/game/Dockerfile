FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl git \
    && rm -rf /var/lib/apt/lists/*

COPY services/game/requirements.txt /app/requirements.txt
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

COPY services/game /app

RUN useradd --create-home --shell /bin/bash appuser \
    && mkdir -p /workspaces/blunderlive \
    && chown -R appuser:appuser /app /workspaces

USER appuser

EXPOSE 8005

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8005"]
