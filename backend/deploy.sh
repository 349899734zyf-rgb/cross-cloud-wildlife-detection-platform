#!/usr/bin/env bash
# deploy.sh — Build Docker images and deploy Lambda stack via SAM.
# Usage: backend/deploy.sh [dev|prod]
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "${SCRIPT_DIR}"

ENV=${1:-prod}
REGION=${AWS_DEFAULT_REGION:-ap-southeast-2}
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
STACK_NAME="ecolens-lambdas-${ENV}"
ECR_BASE="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

echo "=== EcoLens Lambda Deploy ==="
echo "Account : ${ACCOUNT_ID}"
echo "Region  : ${REGION}"
echo "Stack   : ${STACK_NAME}"
echo "Env     : ${ENV}"
echo ""

# ---- 1. Authenticate Docker with ECR ----
echo "[1/4] Logging in to ECR..."
aws ecr get-login-password --region "${REGION}" \
  | docker login --username AWS --password-stdin "${ECR_BASE}"

# ---- 2. Ensure ECR repositories exist ----
for repo in ecolens-thumbnail-generator ecolens-ml-tagger; do
  if ! aws ecr describe-repositories --repository-names "${repo}" \
       --region "${REGION}" &>/dev/null; then
    echo "Creating ECR repository: ${repo}"
    aws ecr create-repository --repository-name "${repo}" \
        --region "${REGION}" --image-scanning-configuration scanOnPush=true
  fi
done

# ---- 3. SAM build (builds Docker images) ----
echo "[2/4] Building Docker images with sam build..."
sam build --template template.yaml --use-container 2>&1 | tail -20

# ---- 4. SAM deploy ----
echo "[3/4] Deploying stack: ${STACK_NAME}..."
sam deploy \
  --template-file .aws-sam/build/template.yaml \
  --stack-name "${STACK_NAME}" \
  --region "${REGION}" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --image-repositories \
    ThumbnailGeneratorFunction="${ECR_BASE}/ecolens-thumbnail-generator" \
    MLTaggerFunction="${ECR_BASE}/ecolens-ml-tagger" \
  --parameter-overrides \
    Environment="${ENV}" \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset

echo "[4/4] Done."
aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${REGION}" \
  --query "Stacks[0].Outputs" \
  --output table
