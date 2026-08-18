variable "aws_region" {
  description = "The target AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "The 12-digit AWS Account ID"
  type        = string
  default     = "171376498459"
}

variable "project_name" {
  description = "Project name prefix used for naming resources"
  type        = string
  default     = "blunderlive"
}

variable "github_repo" {
  description = "GitHub repository in the format owner/repo for OIDC trust scoping"
  type        = string
  default     = "jabaadamia/blunderlive"
}

variable "billing_alert_email" {
  description = "Email address to receive CloudWatch billing alarms (optional, leave empty to skip SNS email)"
  type        = string
  default     = ""
}
