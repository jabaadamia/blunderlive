output "alb_dns_name" {
  description = "The public DNS URL of the Application Load Balancer"
  value       = "http://${aws_lb.main.dns_name}"
}

output "rds_endpoint" {
  description = "Postgres RDS endpoint address"
  value       = aws_db_instance.postgres.address
}

output "elasticache_endpoint" {
  description = "Redis ElastiCache endpoint address"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "ecs_cluster_name" {
  description = "Name of the ECS Cluster"
  value       = aws_ecs_cluster.main.name
}

output "service_names" {
  description = "List of running ECS service names"
  value = [
    aws_ecs_service.frontend.name,
    aws_ecs_service.core.name,
    aws_ecs_service.core_worker.name,
    aws_ecs_service.game.name,
    aws_ecs_service.game_worker.name
  ]
}

output "ecs_subnet_ids" {
  description = "IDs of the public subnets used by ECS Fargate tasks (for one-off run-task network configuration)"
  value       = [aws_subnet.public_1.id, aws_subnet.public_2.id]
}

output "ecs_security_group_id" {
  description = "ID of the security group attached to ECS Fargate tasks (for one-off run-task network configuration)"
  value       = aws_security_group.ecs_tasks.id
}
