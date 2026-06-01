#!/usr/bin/env bash
# setup_s3_triggers.sh
# Run ONCE after `./deploy.sh` to wire S3 upload events to both Lambda functions.
# Safe to re-run — it overwrites the notification config each time.
set -euo pipefail

ENV=${1:-prod}
REGION=${AWS_DEFAULT_REGION:-ap-southeast-2}
STACK_NAME="ecolens-lambdas-${ENV}"
UPLOAD_BUCKET=${UPLOAD_BUCKET:-ecolens-uploads-288515363084}

echo "=== Wiring S3 → Lambda triggers for ${UPLOAD_BUCKET} ==="

# Fetch Lambda ARNs from the deployed stack
THUMBNAIL_ARN=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" --region "${REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='ThumbnailGeneratorArn'].OutputValue" \
  --output text)

ML_TAGGER_ARN=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" --region "${REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='MLTaggerArn'].OutputValue" \
  --output text)

echo "Thumbnail Generator : ${THUMBNAIL_ARN}"
echo "ML Tagger           : ${ML_TAGGER_ARN}"

# Apply notification configuration — both Lambdas triggered by every ObjectCreated.
# Extension filtering is handled inside each Lambda function.
aws s3api put-bucket-notification-configuration \
  --bucket "${UPLOAD_BUCKET}" \
  --region "${REGION}" \
  --notification-configuration "{
    \"LambdaFunctionConfigurations\": [
      {
        \"LambdaFunctionArn\": \"${THUMBNAIL_ARN}\",
        \"Events\": [\"s3:ObjectCreated:*\"]
      },
      {
        \"LambdaFunctionArn\": \"${ML_TAGGER_ARN}\",
        \"Events\": [\"s3:ObjectCreated:*\"]
      }
    ]
  }"

echo "Done. Both Lambda triggers are active on s3://${UPLOAD_BUCKET}"
