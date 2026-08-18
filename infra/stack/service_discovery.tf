# -----------------------------------------------------------------------------
# Cloud Map Namespace + DNS-Based Service Discovery
# Route 53 private hosted zone (blunderlive.local) resolves via the standard
# VPC DNS resolver (169.254.169.253), which is confirmed working in this
# account. Service Connect was removed because its runtime DNS injection is
# not operational here.
# -----------------------------------------------------------------------------
resource "aws_service_discovery_private_dns_namespace" "main" {
  name        = "${var.project_name}.local"
  description = "Private DNS namespace for internal service discovery (Route 53 private hosted zone)"
  vpc         = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-discovery-ns"
  }
}

resource "aws_service_discovery_service" "core" {
  name = "core"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  tags = {
    Name = "${var.project_name}-discovery-core"
  }
}

resource "aws_service_discovery_service" "game" {
  name = "game"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  tags = {
    Name = "${var.project_name}-discovery-game"
  }
}