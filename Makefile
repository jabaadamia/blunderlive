CORE_APP_VOLUME := -v $(CURDIR)/services/core:/app
GAME_APP_VOLUME := -v $(CURDIR)/services/game:/app
FRONTEND_APP_VOLUME := -v $(CURDIR)/frontend:/app
POSTGRES_USER := $(shell grep ^POSTGRES_USER .env | cut -d= -f2)
POSTGRES_DB := $(shell grep ^POSTGRES_DB .env | cut -d= -f2)
COMPOSE_BASE := docker compose -f compose.yaml --env-file .env
ENV ?= dev
ifeq ($(ENV),dev)
	COMPOSE := $(COMPOSE_BASE) -f compose.override.dev.yaml
else
	COMPOSE := $(COMPOSE_BASE) -f compose.override.prod.yaml
endif

.PHONY: help init up down restart logs ps clean build makemigrations-core migrate-core test-core test-game test-frontend lint-frontend build-frontend check-core check-game check-frontend check-all

help:
	@echo "Available targets:"
	@echo "  init     Copy .env.example to .env if missing"
	@echo "  up       Start local services"
	@echo "  down     Stop running containers"
	@echo "  restart  Restart containers"
	@echo "  logs     Tail container logs"
	@echo "  ps       Show service status"
	@echo "  build    Build containers"
	@echo "  makemigrations-core  Create Django core migrations"
	@echo "  migrate-core  Run Django core migrations"
	@echo "  postgres-shell  Open a psql shell to the postgres container"
	@echo "  test-core  Run core pytest suite"
	@echo "  test-game  Run game pytest suite"
	@echo "  test-frontend  Run frontend tests"
	@echo "  lint-frontend  Run frontend lint checks"
	@echo "  build-frontend  Run frontend production build"
	@echo "  check-core  Run Django core checks and tests"
	@echo "  check-game  Run game tests"
	@echo "  check-frontend  Run frontend lint and build"
	@echo "  check-all   Run core, game, and frontend checks"
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

makemigrations-core:
	$(COMPOSE) up -d postgres
	$(COMPOSE) run --rm $(CORE_APP_VOLUME) core python manage.py makemigrations

migrate-core:
	$(COMPOSE) up -d postgres
	$(COMPOSE) run --rm $(CORE_APP_VOLUME) core python manage.py migrate

postgres-shell:
	$(COMPOSE) up -d postgres
	$(COMPOSE) exec postgres psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

test-core:
	$(COMPOSE) up -d postgres
	$(COMPOSE) run --rm $(CORE_APP_VOLUME) core pytest

test-game:
	$(COMPOSE) up -d redis
	$(COMPOSE) run --rm $(GAME_APP_VOLUME) game pytest

test-frontend:
	$(COMPOSE) run --rm $(FRONTEND_APP_VOLUME) frontend npm run test --if-present

lint-frontend:
	$(COMPOSE) exec frontend npm run lint || $(COMPOSE) run --rm --no-deps $(FRONTEND_APP_VOLUME) frontend npm run lint

build-frontend:
	$(COMPOSE) exec frontend npm run build || $(COMPOSE) run --rm --no-deps $(FRONTEND_APP_VOLUME) frontend npm run build

check-core:
	$(COMPOSE) up -d postgres
	$(COMPOSE) run --rm $(CORE_APP_VOLUME) core python manage.py check
	$(MAKE) test-core

check-game:
	$(MAKE) test-game

check-frontend:
	$(MAKE) lint-frontend
	$(MAKE) build-frontend

check-all:
	$(MAKE) check-core
	$(MAKE) check-game
	$(MAKE) check-frontend

clean:
	$(COMPOSE) down -v