FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN useradd --create-home --shell /bin/bash appuser

WORKDIR /app

COPY services/game/requirements.txt /tmp/requirements.txt
RUN pip install --upgrade pip \
    && pip install -r /tmp/requirements.txt

FROM base AS dev

COPY services/game /app
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8005

CMD ["sh", "-c", "uvicorn app.main:app --host ${APP_HOST} --port ${GAME_PORT} --reload"]

FROM base AS runtime

COPY services/game /app
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8005

CMD ["sh", "-c", "uvicorn app.main:app --host ${APP_HOST} --port ${GAME_PORT}"]
