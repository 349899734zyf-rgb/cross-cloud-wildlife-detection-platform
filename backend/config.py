# AWS Resource Configuration
# Fill in the values after creating resources on AWS Console

AWS_REGION = "us-east-1"
AWS_ACCOUNT_ID = "288515363084"

# --- Cognito ---
COGNITO_USER_POOL_ID = "us-east-1_jijBmZk13"
COGNITO_APP_CLIENT_ID = "1n6j3vvt3gahq48sl969fhdmls"

# --- S3 Buckets ---
S3_UPLOAD_BUCKET = "ecolens-uploads-288515363084"
S3_THUMBNAIL_BUCKET = "ecolens-thumbnails-288515363084"
S3_MODEL_BUCKET = "ecolens-models-288515363084"

# --- DynamoDB ---
DYNAMODB_FILES_TABLE = "ecolens-files"
DYNAMODB_SUBSCRIPTIONS_TABLE = "ecolens-subscriptions"

# --- IAM ---
LAB_ROLE_ARN = "arn:aws:iam::288515363084:role/LabRole"

# --- API Gateway ---
API_GATEWAY_URL = ""            # Fill in after creating API Gateway in Phase 2

# --- SNS ---
SNS_TOPIC_ARN = ""              # Fill in after creating SNS topic
