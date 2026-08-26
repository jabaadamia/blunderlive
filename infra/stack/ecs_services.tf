# =============================================================================
# ECS TASK DEFINITIONS & SERVICES
# =============================================================================

locals {
  ecr_registry = "${var.aws_account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
  redis_url    = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:${aws_elasticache_cluster.redis.cache_nodes[0].port}/0"
}

# -----------------------------------------------------------------------------
# 1. CORE SERVICE (Django Gunicorn + Automated Migrations)
# -----------------------------------------------------------------------------
resource "aws_ecs_task_definition" "core" {
  family                   = "${var.project_name}-core"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "core"
      image     = "${local.ecr_registry}/${var.project_name}-core:${var.core_image_tag}"
      essential = true
      command = [
        "sh",
        "-c",
        "python manage.py collectstatic --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 2 --timeout 60"
      ]

      portMappings = [
        {
          name          = "core-port"
          containerPort = 8000
          hostPort      = 8000
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "DJANGO_SETTINGS_MODULE", value = "config.settings.production" },
        { name = "CORE_DEBUG", value = "False" },
        { name = "CORE_ALLOWED_HOSTS", value = "*" },
        { name = "REDIS_URL", value = local.redis_url },
        { name = "CORE_GAMES_FINISHED_STREAM", value = "games.finished" },
        { name = "CORE_GAMES_PROCESSED_STREAM", value = "games.processed" },
        { name = "CORE_GAMES_FAILED_STREAM", value = "games.failed" },
        { name = "CORE_GAMES_CONSUMER_GROUP", value = "core-game-processing" },
        { name = "CORE_CSRF_TRUSTED_ORIGINS", value = "http://${aws_lb.main.dns_name}" },
        { name = "GUNICORN_WORKERS", value = "2" },
        { name = "GUNICORN_TIMEOUT", value = "60" }
      ]

      secrets = [
        {
          name      = "CORE_DATABASE_URL"
          valueFrom = aws_ssm_parameter.core_database_url.arn
        },
        {
          name      = "CORE_SECRET_KEY"
          valueFrom = "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/${var.project_name}/production/CORE_SECRET_KEY"
        },
        {
          name      = "CORE_JWT_PRIVATE_KEY"
          valueFrom = "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/${var.project_name}/production/CORE_JWT_PRIVATE_KEY"
        },
        {
          name      = "CORE_JWT_PUBLIC_KEY"
          valueFrom = "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/${var.project_name}/production/CORE_JWT_PUBLIC_KEY"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "core"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-core-td"
  }
}

resource "aws_ecs_service" "core" {
  name            = "${var.project_name}-core"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.core.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public_1.id, aws_subnet.public_2.id]
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.core.arn
    container_name   = "core"
    container_port   = 8000
  }

  service_registries {
    registry_arn   = aws_service_discovery_service.core.arn
    container_name = "core"
  }

  depends_on = [aws_lb_listener.http, aws_db_instance.postgres, aws_elasticache_cluster.redis]

  tags = {
    Name = "${var.project_name}-core-service"
  }
}

# -----------------------------------------------------------------------------
# 2. CORE WORKER (Django Game Stream Consumer)
# -----------------------------------------------------------------------------
resource "aws_ecs_task_definition" "core_worker" {
  family                   = "${var.project_name}-core-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "core-worker"
      image     = "${local.ecr_registry}/${var.project_name}-core:${var.core_image_tag}"
      essential = true
      command   = ["python", "manage.py", "process_finished_games"]

      environment = [
        { name = "DJANGO_SETTINGS_MODULE", value = "config.settings.production" },
        { name = "CORE_DEBUG", value = "False" },
        { name = "CORE_ALLOWED_HOSTS", value = "*" },
        { name = "REDIS_URL", value = local.redis_url },
        { name = "CORE_GAMES_FINISHED_STREAM", value = "games.finished" },
        { name = "CORE_GAMES_PROCESSED_STREAM", value = "games.processed" },
        { name = "CORE_GAMES_FAILED_STREAM", value = "games.failed" },
        { name = "CORE_GAMES_CONSUMER_GROUP", value = "core-game-processing" }
      ]

      secrets = [
        {
          name      = "CORE_DATABASE_URL"
          valueFrom = aws_ssm_parameter.core_database_url.arn
        },
        {
          name      = "CORE_SECRET_KEY"
          valueFrom = "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/${var.project_name}/production/CORE_SECRET_KEY"
        },
        {
          name      = "CORE_JWT_PRIVATE_KEY"
          valueFrom = "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/${var.project_name}/production/CORE_JWT_PRIVATE_KEY"
        },
        {
          name      = "CORE_JWT_PUBLIC_KEY"
          valueFrom = "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/${var.project_name}/production/CORE_JWT_PUBLIC_KEY"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "core-worker"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-core-worker-td"
  }
}

resource "aws_ecs_service" "core_worker" {
  name            = "${var.project_name}-core-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.core_worker.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public_1.id, aws_subnet.public_2.id]
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

  depends_on = [aws_db_instance.postgres, aws_elasticache_cluster.redis]

  tags = {
    Name = "${var.project_name}-core-worker-service"
  }
}

# -----------------------------------------------------------------------------
# 3. GAME SERVICE (FastAPI WebSocket & REST)
# -----------------------------------------------------------------------------
resource "aws_ecs_task_definition" "game" {
  family                   = "${var.project_name}-game"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "game"
      image     = "${local.ecr_registry}/${var.project_name}-game:${var.game_image_tag}"
      essential = true

      portMappings = [
        {
          name          = "game-port"
          containerPort = 8005
          hostPort      = 8005
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "APP_NAME", value = "${var.project_name}-game" },
        { name = "APP_ENV", value = "production" },
        { name = "APP_HOST", value = "0.0.0.0" },
        { name = "GAME_PORT", value = "8005" },
        { name = "LOG_LEVEL", value = "INFO" },
        { name = "REDIS_URL", value = local.redis_url },
        { name = "CORE_GAMES_FINISHED_STREAM", value = "games.finished" },
        { name = "CORE_GAMES_PROCESSED_STREAM", value = "games.processed" },
        { name = "GAME_GAMES_PROCESSED_CONSUMER_GROUP", value = "game-rating-updates" },
        { name = "CORS_ALLOWED_ORIGINS", value = "*" },
        { name = "CORE_API_BASE_URL", value = "http://core.${aws_service_discovery_private_dns_namespace.main.name}:8000" }
      ]

      secrets = [
        {
          name      = "GAME_JWT_PUBLIC_KEY"
          valueFrom = "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/${var.project_name}/production/GAME_JWT_PUBLIC_KEY"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "game"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-game-td"
  }
}

resource "aws_ecs_service" "game" {
  name            = "${var.project_name}-game"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.game.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public_1.id, aws_subnet.public_2.id]
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.game.arn
    container_name   = "game"
    container_port   = 8005
  }

  service_registries {
    registry_arn   = aws_service_discovery_service.game.arn
    container_name = "game"
  }

  depends_on = [aws_lb_listener.http, aws_elasticache_cluster.redis]

  tags = {
    Name = "${var.project_name}-game-service"
  }
}

# -----------------------------------------------------------------------------
# 4. GAME WORKER (Matchmaking & Deadline Sweep)
# -----------------------------------------------------------------------------
resource "aws_ecs_task_definition" "game_worker" {
  family                   = "${var.project_name}-game-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "game-worker"
      image     = "${local.ecr_registry}/${var.project_name}-game:${var.game_image_tag}"
      essential = true
      command   = ["python", "-m", "app.worker"]

      environment = [
        { name = "APP_NAME", value = "${var.project_name}-game-worker" },
        { name = "APP_ENV", value = "production" },
        { name = "LOG_LEVEL", value = "INFO" },
        { name = "REDIS_URL", value = local.redis_url },
        { name = "CORE_GAMES_FINISHED_STREAM", value = "games.finished" },
        { name = "CORE_GAMES_PROCESSED_STREAM", value = "games.processed" },
        { name = "GAME_GAMES_PROCESSED_CONSUMER_GROUP", value = "game-rating-updates" },
        { name = "CORS_ALLOWED_ORIGINS", value = "*" },
        { name = "CORE_API_BASE_URL", value = "http://core.${aws_service_discovery_private_dns_namespace.main.name}:8000" }
      ]

      secrets = [
        {
          name      = "GAME_JWT_PUBLIC_KEY"
          valueFrom = "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/${var.project_name}/production/GAME_JWT_PUBLIC_KEY"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "game-worker"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-game-worker-td"
  }
}

resource "aws_ecs_service" "game_worker" {
  name            = "${var.project_name}-game-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.game_worker.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public_1.id, aws_subnet.public_2.id]
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

  depends_on = [aws_elasticache_cluster.redis]

  tags = {
    Name = "${var.project_name}-game-worker-service"
  }
}

# -----------------------------------------------------------------------------
# 5. FRONTEND SERVICE (Next.js Standalone Runner)
# -----------------------------------------------------------------------------
resource "aws_ecs_task_definition" "frontend" {
  family                   = "${var.project_name}-frontend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "frontend"
      image     = "${local.ecr_registry}/${var.project_name}-frontend:${var.frontend_image_tag}"
      essential = true

      portMappings = [
        {
          name          = "frontend-port"
          containerPort = 3000
          hostPort      = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3000" },
        { name = "HOSTNAME", value = "0.0.0.0" },
        { name = "INTERNAL_CORE_URL", value = "http://core.${aws_service_discovery_private_dns_namespace.main.name}:8000" },
        { name = "INTERNAL_GAME_URL", value = "http://game.${aws_service_discovery_private_dns_namespace.main.name}:8005" },
        { name = "AUTH_COOKIE_SECURE", value = "false" }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "frontend"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-frontend-td"
  }
}

resource "aws_ecs_service" "frontend" {
  name            = "${var.project_name}-frontend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public_1.id, aws_subnet.public_2.id]
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.http]

  tags = {
    Name = "${var.project_name}-frontend-service"
  }
}

