# -----------------------------------------------------------------------------
# RDS Postgres Database
# -----------------------------------------------------------------------------
data "aws_ssm_parameter" "db_password" {
  name            = "/${var.project_name}/production/POSTGRES_PASSWORD"
  with_decryption = true
}

resource "aws_db_subnet_group" "rds" {
  name        = "${var.project_name}-db-subnet-group"
  description = "Subnet group for RDS instance in isolated subnets"
  subnet_ids  = [aws_subnet.isolated_1.id, aws_subnet.isolated_2.id]

  tags = {
    Name = "${var.project_name}-db-subnet-group"
  }
}

resource "aws_db_parameter_group" "rds" {
  name        = "${var.project_name}-pg16-params"
  family      = "postgres16"
  description = "Custom parameter group for Postgres 16"

  tags = {
    Name = "${var.project_name}-pg16-params"
  }
}

resource "aws_db_instance" "postgres" {
  identifier        = "${var.project_name}-postgres"
  engine            = "postgres"
  engine_version    = "16.3"
  instance_class    = "db.t4g.micro" # Cheap ARM instance; billed from account credits (no legacy free tier on this account)
  allocated_storage = 20             # 20 GB gp3 minimum
  storage_type      = "gp3"

  db_name  = var.db_name
  username = var.db_username
  password = data.aws_ssm_parameter.db_password.value

  db_subnet_group_name   = aws_db_subnet_group.rds.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.rds.name

  publicly_accessible = false
  multi_az            = false

  skip_final_snapshot        = true  # Required for ephemeral stack destroy without retaining billable snapshots
  deletion_protection        = false # Allows easy terraform destroy cycles
  auto_minor_version_upgrade = true

  backup_retention_period = 0 # Ephemeral stack, no automated backup charges

  tags = {
    Name = "${var.project_name}-postgres"
  }
}

# -----------------------------------------------------------------------------
# Dynamic Database Connection URL stored as SecureString in SSM
# Injected into ECS tasks via task definition `secrets` block (never plain text)
# -----------------------------------------------------------------------------
resource "aws_ssm_parameter" "core_database_url" {
  name        = "/${var.project_name}/production/CORE_DATABASE_URL"
  description = "Full connection URL for Postgres RDS database"
  type        = "SecureString"
  value       = "postgresql://${var.db_username}:${data.aws_ssm_parameter.db_password.value}@${aws_db_instance.postgres.address}:${aws_db_instance.postgres.port}/${var.db_name}"

  tags = {
    Name = "/${var.project_name}/production/CORE_DATABASE_URL"
  }
}
