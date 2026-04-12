FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

RUN useradd --create-home --shell /bin/bash appuser

WORKDIR /workspaces/blunderlive/services/core

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl git \
    && rm -rf /var/lib/apt/lists/*

COPY services/core/requirements.txt .
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

COPY services/core .

RUN chown -R appuser:appuser /workspaces/blunderlive

USER appuser
EXPOSE 8000
