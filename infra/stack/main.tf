terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "blunderlive-tf-state-171376498459"
    key            = "stack/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "blunderlive-tf-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = "production"
      ManagedBy   = "terraform"
      Layer       = "stack"
    }
  }
}
