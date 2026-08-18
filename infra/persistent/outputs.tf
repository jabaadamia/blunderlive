output "aws_region" {
  description = "AWS region"
  value       = var.aws_region
}

output "s3_tf_state_bucket" {
  description = "S3 bucket for Terraform remote state"
  value       = aws_s3_bucket.tf_state.bucket
}

output "dynamodb_tf_locks_table" {
  description = "DynamoDB table for Terraform state locking"
  value       = aws_dynamodb_table.tf_locks.name
}

output "ecr_repository_urls" {
  description = "Map of ECR repository names to their repository URLs"
  value = {
    for k, v in aws_ecr_repository.repos : k => v.repository_url
  }
}

output "github_actions_role_arn" {
  description = "ARN of the IAM role for GitHub Actions deployment via OIDC"
  value       = aws_iam_role.github_actions_deployer.arn
}

output "ssm_parameter_names" {
  description = "Names of the created SSM secret parameters"
  value       = [for p in aws_ssm_parameter.secrets : p.name]
}
