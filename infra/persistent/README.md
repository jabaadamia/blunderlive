# Persistent Infrastructure (`infra/persistent/`)

This directory contains Terraform resources that are provisioned once and stay up permanently. Their cost is negligible or zero.

## Resources Created
- **S3 Remote State Bucket**: Encrypted & versioned S3 bucket for Terraform states.
- **DynamoDB Locks Table**: For state locking during Terraform plans/applies.
- **ECR Repositories**: 3 container registries (`blunderlive-frontend`, `blunderlive-core`, `blunderlive-game`) with auto-pruning lifecycle policies (keeps at most 5 tagged images to avoid storage buildup).
- **GitHub Actions OIDC IAM Role**: Allows GitHub Actions workflows to push images and update ECS tasks securely without long-lived AWS access keys.
- **CloudWatch Billing Alarms**: $20 and $50 estimated charge guardrail alarms.
- **SSM Parameter Store Skeletons**: Placeholders for production secrets under `/blunderlive/production/*`.

## How to Apply

1. Change directory:
   ```bash
   cd infra/persistent
   ```

2. Initialize Terraform (local state initially):
   ```bash
   terraform init
   ```

3. Review the plan:
   ```bash
   terraform plan
   ```

4. Apply the resources:
   ```bash
   terraform apply
   ```

5. *(Optional)* After the S3 bucket is created, you can uncomment the `backend "s3"` block in `main.tf` and migrate local state to S3:
   ```bash
   terraform init -migrate-state
   ```
