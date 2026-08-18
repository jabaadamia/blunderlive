terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # NOTE: When running `terraform init` for the first time on persistent infra,
  # the remote S3 backend does not exist yet. Run `terraform apply` locally first,
  # and then you can optionally uncomment the backend block below and run `terraform init -migrate-state`.
  #
  # backend "s3" {
  #   bucket         = "blunderlive-tf-state-171376498459"
  #   key            = "persistent/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "blunderlive-tf-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = "production"
      ManagedBy   = "terraform"
      Layer       = "persistent"
    }
  }
}
