locals {
  ecr_repositories = [
    "${var.project_name}-frontend",
    "${var.project_name}-core",
    "${var.project_name}-game"
  ]
}

resource "aws_ecr_repository" "repos" {
  for_each = toset(local.ecr_repositories)

  name                 = each.key
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = each.key
  }
}

# Lifecycle policy: Retain only the 5 most recent images regardless of tag format (raw sha, prefixed sha, v1, etc.),
# and expire untagged images older than 1 day.
resource "aws_ecr_lifecycle_policy" "repo_policies" {
  for_each = aws_ecr_repository.repos

  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images older than 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Keep last 5 images of any tag to minimize ECR storage costs"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 5
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
