# -----------------------------------------------------------------------------
# ECS Fargate Cluster
# -----------------------------------------------------------------------------
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  setting {
    name  = "containerInsights"
    value = "disabled" # Keep disabled to avoid CloudWatch custom metrics billing
  }

  tags = {
    Name = "${var.project_name}-cluster"
  }
}
