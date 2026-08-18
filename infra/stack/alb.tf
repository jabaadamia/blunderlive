# -----------------------------------------------------------------------------
# Application Load Balancer (ALB)
# -----------------------------------------------------------------------------
resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_1.id, aws_subnet.public_2.id]

  idle_timeout = 3600 # 1 hour timeout for WebSocket connections (/ws/*)

  tags = {
    Name = "${var.project_name}-alb"
  }
}

# -----------------------------------------------------------------------------
# Target Groups
# -----------------------------------------------------------------------------

# 1. Frontend Target Group
resource "aws_lb_target_group" "frontend" {
  name        = "${var.project_name}-tg-frontend"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/"
    port                = "3000"
    protocol            = "HTTP"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200-399"
  }

  tags = {
    Name = "${var.project_name}-tg-frontend"
  }
}

# 2. Core API Target Group
resource "aws_lb_target_group" "core" {
  name        = "${var.project_name}-tg-core"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/health/live"
    port                = "8000"
    protocol            = "HTTP"
    interval            = 20
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  tags = {
    Name = "${var.project_name}-tg-core"
  }
}

# 3. Game API & WebSocket Target Group
resource "aws_lb_target_group" "game" {
  name        = "${var.project_name}-tg-game"
  port        = 8005
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/health/live"
    port                = "8005"
    protocol            = "HTTP"
    interval            = 20
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  tags = {
    Name = "${var.project_name}-tg-game"
  }
}

# -----------------------------------------------------------------------------
# ALB Listeners & Routing Rules
# -----------------------------------------------------------------------------

# HTTP Listener (Port 80)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  # Default action forwards to frontend unless HTTPS redirect is enabled
  default_action {
    type = var.enable_custom_domain ? "redirect" : "forward"

    dynamic "redirect" {
      for_each = var.enable_custom_domain ? [1] : []
      content {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }

    target_group_arn = var.enable_custom_domain ? null : aws_lb_target_group.frontend.arn
  }
}

# Route 1: Game WebSockets (/ws/*)
resource "aws_lb_listener_rule" "game_ws" {
  listener_arn = var.enable_custom_domain ? aws_lb_listener.https[0].arn : aws_lb_listener.http.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.game.arn
  }

  condition {
    path_pattern {
      values = ["/ws", "/ws/*"]
    }
  }
}

# Route 2: Game HTTP API (/api/game/*)
resource "aws_lb_listener_rule" "game_api" {
  listener_arn = var.enable_custom_domain ? aws_lb_listener.https[0].arn : aws_lb_listener.http.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.game.arn
  }

  condition {
    path_pattern {
      values = ["/api/game", "/api/game/*"]
    }
  }
}

# Route 3: Core API (/api/*)
resource "aws_lb_listener_rule" "core_api" {
  listener_arn = var.enable_custom_domain ? aws_lb_listener.https[0].arn : aws_lb_listener.http.arn
  priority     = 30

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.core.arn
  }

  condition {
    path_pattern {
      values = ["/api", "/api/*"]
    }
  }
}

# -----------------------------------------------------------------------------
# Optional HTTPS Listener (for Option B in the future)
# -----------------------------------------------------------------------------
resource "aws_lb_listener" "https" {
  count             = var.enable_custom_domain ? 1 : 0
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}
