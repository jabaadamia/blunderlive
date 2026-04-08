COMPOSE := docker compose -f compose.yaml --env-file .env

.PHONY: help init up down restart logs ps clean build test lint format check

help:
	@echo "Available targets:"
	@echo "  init     Copy .env.example to .env if missing"
	@echo "  up       Start game service and redis"
	@echo "  down     Stop running containers"
	@echo "  restart  Restart containers"
	@echo "  logs     Tail container logs"
	@echo "  ps       Show service status"
	@echo "  build    Build containers"
	@echo "  lint     Run Ruff"
	@echo "  test     Run pytest"
	@echo "  check    Run lint and tests"
	@echo "  clean    Stop services and remove volumes"

init:
	@test -f .env || cp .env.example .env

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

build:
	$(COMPOSE) build

restart:
	$(COMPOSE) down
	$(COMPOSE) up -d

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

lint:
	$(COMPOSE) run --rm game ruff check .

test:
	$(COMPOSE) up -d redis
	$(COMPOSE) run --rm game pytest

check:
	$(MAKE) lint
	$(MAKE) test

clean:
	$(COMPOSE) down -v
