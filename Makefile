ENV ?= dev
VALID_ENVS := dev prod

ifeq ($(filter $(ENV),$(VALID_ENVS)),)
$(error ENV must be one of: $(VALID_ENVS))
endif

COMPOSE := docker compose --env-file .env -f compose.yaml -f compose.override.$(ENV).yaml
TEST_COMPOSE_PROJECT ?= blunderlive-test
TEST_COMPOSE := COMPOSE_PROJECT_NAME=$(TEST_COMPOSE_PROJECT) docker compose --env-file .env -f compose.yaml
FRONTEND_BUILD_COMPOSE := docker compose --env-file .env -f compose.yaml -f compose.override.prod.yaml
TEST_REDIS_URL := redis://redis:6379/15
POSTGRES_USER := $(shell grep -E '^POSTGRES_USER=' .env 2>/dev/null | cut -d= -f2)
POSTGRES_DB := $(shell grep -E '^POSTGRES_DB=' .env 2>/dev/null | cut -d= -f2)

.PHONY: help init ensure-dev-jwt config build build-dev build-prod up up-dev up-prod down down-dev down-prod restart logs ps bootstrap \
	collectstatic-core makemigrations-core migrate-core postgres-shell core-shell game-shell frontend-shell \
	test-core test-game test-frontend lint-frontend build-frontend check-core check-game check-frontend check-all clean

help:
	@echo "Usage: make <target> [ENV=dev|prod]"
	@echo ""
	@echo "Main targets:"
	@echo "  init               Create .env from .env.example if it is missing"
	@echo "  build              Build images for the selected environment"
	@echo "  up                 Start the selected environment"
	@echo "  down               Stop the selected environment"
	@echo "  restart            Restart the selected environment"
	@echo "  logs               Tail logs for the selected environment"
	@echo "  ps                 Show container status for the selected environment"
	@echo "  config             Print the merged Docker Compose config"
	@echo ""
	@echo "Environment shortcuts:"
	@echo "  up-dev / build-dev / down-dev"
	@echo "  up-prod / build-prod / down-prod"
	@echo ""
	@echo "Maintenance:"
	@echo "  bootstrap          Run migrations and, in prod, collect static files"
	@echo "  makemigrations-core"
	@echo "  migrate-core"
	@echo "  collectstatic-core"
	@echo "  postgres-shell"
	@echo "  core-shell / game-shell / frontend-shell"
	@echo ""
	@echo "Checks:"
	@echo "  test-core / test-game / test-frontend"
	@echo "  lint-frontend / build-frontend"
	@echo "  check-core / check-game / check-frontend / check-all"
	@echo ""
	@echo "Cleanup:"
	@echo "  clean              Stop services and remove volumes for the selected environment"

init:
	@test -f .env || cp .env.example .env
	@$(MAKE) ensure-dev-jwt

ensure-dev-jwt:
	@mkdir -p infra/dev-jwt
	@if [ ! -f infra/dev-jwt/private.pem ] || [ ! -f infra/dev-jwt/public.pem ]; then \
		echo "Generating development JWT RSA keypair under infra/dev-jwt"; \
		openssl genrsa -out infra/dev-jwt/private.pem 2048 >/dev/null 2>&1; \
		openssl rsa -in infra/dev-jwt/private.pem -pubout -out infra/dev-jwt/public.pem >/dev/null 2>&1; \
	fi

config:
	$(COMPOSE) config

build:
	$(COMPOSE) build

build-dev:
	$(MAKE) build ENV=dev

build-prod:
	$(MAKE) build ENV=prod

up:
ifeq ($(ENV),prod)
	$(MAKE) bootstrap ENV=prod
endif
	$(COMPOSE) up -d --remove-orphans

up-dev:
	$(MAKE) up ENV=dev

up-prod:
	$(MAKE) up ENV=prod

down:
	$(COMPOSE) down

down-dev:
	$(MAKE) down ENV=dev

down-prod:
	$(MAKE) down ENV=prod

restart:
	$(COMPOSE) down
	$(COMPOSE) up -d --remove-orphans

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

bootstrap:
	$(COMPOSE) up -d postgres redis
	$(COMPOSE) run --rm core python manage.py migrate
ifeq ($(ENV),prod)
	$(COMPOSE) run --rm core python manage.py collectstatic --noinput
endif

makemigrations-core:
	$(COMPOSE) up -d postgres
	$(COMPOSE) run --rm core python manage.py makemigrations

migrate-core:
	$(COMPOSE) up -d postgres
	$(COMPOSE) run --rm core python manage.py migrate

collectstatic-core:
	$(COMPOSE) run --rm core python manage.py collectstatic --noinput

postgres-shell:
	$(COMPOSE) up -d postgres
	$(COMPOSE) exec postgres psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

core-shell:
	$(COMPOSE) run --rm core sh

game-shell:
	$(COMPOSE) run --rm game sh

frontend-shell:
	$(COMPOSE) run --rm frontend sh

test-core:
	@set -e; \
	$(MAKE) ensure-dev-jwt; \
	$(TEST_COMPOSE) up -d postgres; \
	status=0; \
	$(TEST_COMPOSE) run --rm -e DJANGO_SETTINGS_MODULE=config.settings.local core pytest || status=$$?; \
	$(TEST_COMPOSE) down -v --remove-orphans; \
	exit $$status

test-game:
	$(MAKE) ensure-dev-jwt
	$(COMPOSE) up -d redis
	$(COMPOSE) run --rm -e REDIS_URL=$(TEST_REDIS_URL) game pytest

test-frontend:
	$(COMPOSE) run --rm --no-deps frontend npm run test --if-present

lint-frontend:
	$(COMPOSE) run --rm --no-deps frontend npm run lint

build-frontend:
	$(FRONTEND_BUILD_COMPOSE) run --rm --no-deps frontend npm run build

check-core:
	$(COMPOSE) up -d postgres
	$(COMPOSE) run --rm core python manage.py check
	$(MAKE) test-core ENV=$(ENV)

check-game:
	$(MAKE) test-game ENV=$(ENV)

check-frontend:
	$(MAKE) lint-frontend ENV=$(ENV)
	$(MAKE) build-frontend ENV=$(ENV)

check-all:
	$(MAKE) check-core ENV=$(ENV)
	$(MAKE) check-game ENV=$(ENV)
	$(MAKE) check-frontend ENV=$(ENV)

clean:
	$(COMPOSE) down -v --remove-orphans
