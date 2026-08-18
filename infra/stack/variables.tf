variable "aws_region" {
  description = "Target AWS region"
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "AWS Account ID"
  type        = string
  default     = "171376498459"
}

variable "project_name" {
  description = "Project prefix for resource naming"
  type        = string
  default     = "blunderlive"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

# Image tags for services (defaults to latest or specific git sha)
variable "frontend_image_tag" {
  description = "Tag for frontend image in ECR"
  type        = string
  default     = "latest"
}

variable "core_image_tag" {
  description = "Tag for core image in ECR"
  type        = string
  default     = "latest"
}

variable "game_image_tag" {
  description = "Tag for game image in ECR"
  type        = string
  default     = "latest"
}

# Database settings
variable "db_name" {
  description = "Postgres database name"
  type        = string
  default     = "blunderlive_core"
}

variable "db_username" {
  description = "Postgres master username"
  type        = string
  default     = "blunderlive_admin"
}

# Domain & SSL settings (Option A by default, upgradable to Option B)
variable "enable_custom_domain" {
  description = "Set to true when a custom domain and ACM certificate are available"
  type        = bool
  default     = false
}

variable "domain_name" {
  description = "Custom domain name (e.g., blunderlive.com), used when enable_custom_domain is true"
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "ARN of pre-issued or Route53 ACM certificate, used when enable_custom_domain is true"
  type        = string
  default     = ""
}
