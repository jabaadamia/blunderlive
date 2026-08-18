# -----------------------------------------------------------------------------
# ElastiCache Redis (Single-node cluster, minimal cost)
# -----------------------------------------------------------------------------
resource "aws_elasticache_subnet_group" "redis" {
  name        = "${var.project_name}-redis-subnet-group"
  description = "Subnet group for ElastiCache Redis in isolated subnets"
  subnet_ids  = [aws_subnet.isolated_1.id, aws_subnet.isolated_2.id]

  tags = {
    Name = "${var.project_name}-redis-subnet-group"
  }
}

resource "aws_elasticache_parameter_group" "redis" {
  name   = "${var.project_name}-redis7-params"
  family = "redis7"

  tags = {
    Name = "${var.project_name}-redis7-params"
  }
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${var.project_name}-redis"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = "cache.t4g.micro"
  num_cache_nodes      = 1
  parameter_group_name = aws_elasticache_parameter_group.redis.name
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [aws_security_group.redis.id]
  port                 = 6379

  snapshot_retention_limit = 0 # No automated snapshot storage charges for ephemeral stack

  tags = {
    Name = "${var.project_name}-redis"
  }
}
