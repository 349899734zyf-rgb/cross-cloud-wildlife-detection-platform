"""
Upload Handler Lambda Function

Generates a presigned URL for direct S3 upload from the frontend.
Also checks for duplicate files using checksum.
"""

import json
import os
import boto3
from botocore.config import Config

s3_client = boto3.client("s3", config=Config(signature_version="s3v4"))
dynamodb = boto3.resource("dynamodb")

UPLOAD_BUCKET = os.environ.get("UPLOAD_BUCKET", "ecolens-uploads-288515363084")
FILES_TABLE = os.environ.get("FILES_TABLE", "ecolens-files")

ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp",
    ".mp4", ".avi", ".mov", ".mkv"
}


def build_response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        "body": json.dumps(body),
    }


def lambda_handler(event, context):
    """
    Generate a presigned URL for uploading a file to S3.

    Request body:
    {
        "file_name": "koala.jpg",
        "file_type": "image/jpeg",
        "user_id": "abc-123",
        "checksum": "sha256hash"  (optional, for dedup check)
    }
    """
    try:
        body = json.loads(event.get("body", "{}"))
        file_name = body.get("file_name")
        file_type = body.get("file_type", "application/octet-stream")
        user_id = body.get("user_id", "unknown")
        checksum = body.get("checksum")

        if not file_name:
            return build_response(400, {"error": "file_name is required"})

        # Validate file extension
        ext = os.path.splitext(file_name)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            return build_response(400, {
                "error": f"Unsupported file type: {ext}",
                "allowed": list(ALLOWED_EXTENSIONS),
            })

        # Check for duplicate using checksum
        if checksum:
            table = dynamodb.Table(FILES_TABLE)
            result = table.query(
                IndexName="checksum-index",
                KeyConditionExpression="file_checksum = :c",
                ExpressionAttributeValues={":c": checksum},
            )
            if result.get("Items"):
                return build_response(409, {
                    "error": "Duplicate file detected",
                    "existing_file": result["Items"][0].get("file_url"),
                })

        # Generate S3 key: <user_id>/<filename>
        s3_key = f"{user_id}/{file_name}"

        # Generate presigned URL (valid for 5 minutes)
        presigned_url = s3_client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": UPLOAD_BUCKET,
                "Key": s3_key,
                "ContentType": file_type,
            },
            ExpiresIn=300,
        )

        file_url = f"https://{UPLOAD_BUCKET}.s3.amazonaws.com/{s3_key}"

        return build_response(200, {
            "upload_url": presigned_url,
            "file_url": file_url,
            "s3_key": s3_key,
        })

    except Exception as e:
        print(f"Error: {str(e)}")
        return build_response(500, {"error": str(e)})
