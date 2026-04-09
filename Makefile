COMPOSE := docker compose -f compose.yaml --env-file .env

.PHONY: help init up down restart logs ps clean build test-core test-game check-core check-game check-all

help:
	@echo "Available targets:"
	@echo "  init     Copy .env.example to .env if missing"
	@echo "  up       Start local services"
	@echo "  down     Stop running containers"
	@echo "  restart  Restart containers"
	@echo "  logs     Tail container logs"
	@echo "  ps       Show service status"
	@echo "  build    Build containers"
	@echo "  test-core  Run core pytest suite"
	@echo "  test-game  Run game pytest suite"
	@echo "  check-core  Run Django core checks and tests"
	@echo "  check-game  Run game tests"
	@echo "  check-all   Run core and game checks"
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

test-core:
	$(COMPOSE) up -d postgres
	$(COMPOSE) run --rm core pytest

test-game:
	$(COMPOSE) up -d redis
	$(COMPOSE) run --rm game pytest

check-core:
	$(COMPOSE) up -d postgres
	$(COMPOSE) run --rm core python manage.py check
	$(MAKE) test-core

check-game:
	$(MAKE) test-game

check-all:
	$(MAKE) check-core
	$(MAKE) check-game

clean:
	$(COMPOSE) down -v
