# -----------------------------------------------------------------------------
# Cloud Map Namespace for ECS Service Connect
# -----------------------------------------------------------------------------
resource "aws_service_discovery_private_dns_namespace" "main" {
  name        = "${var.project_name}.local"
  description = "Private DNS namespace for ECS Service Connect internal discovery"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-service-connect-ns"
  }
}
