# -----------------------------------------------------------------------------
# ECS Fargate Cluster
# -----------------------------------------------------------------------------
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  service_connect_defaults {
    namespace = aws_service_discovery_private_dns_namespace.main.arn
  }

  setting {
    name  = "containerInsights"
    value = "disabled" # Keep disabled to avoid CloudWatch custom metrics billing
  }

  tags = {
    Name = "${var.project_name}-cluster"
  }
}
