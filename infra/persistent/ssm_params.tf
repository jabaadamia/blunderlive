# -----------------------------------------------------------------------------
# SSM Parameter Store Placeholders
# Note: Initial placeholder values are created here.
# `ignore_changes = [value]` ensures subsequent `terraform apply` runs will NOT
# overwrite real secret values updated by the user via CLI or AWS Console.
# -----------------------------------------------------------------------------
locals {
  secure_parameters = [
    "CORE_SECRET_KEY",
    "CORE_JWT_PRIVATE_KEY",
    "CORE_JWT_PUBLIC_KEY",
    "GAME_JWT_PUBLIC_KEY",
    "POSTGRES_PASSWORD"
  ]
}

resource "aws_ssm_parameter" "secrets" {
  for_each = toset(local.secure_parameters)

  name        = "/${var.project_name}/production/${each.key}"
  description = "Secret parameter for ${each.key}"
  type        = "SecureString"
  value       = "CHANGE_ME_INITIAL_PLACEHOLDER"

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Name = "/${var.project_name}/production/${each.key}"
  }
}
