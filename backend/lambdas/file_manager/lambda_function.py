"""
File Manager Lambda Function

Handles file deletion: removes S3 objects and DynamoDB records.
"""

import json
import os
import boto3

s3_client = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")

FILES_TABLE = os.environ.get("FILES_TABLE", "ecolens-files")
UPLOAD_BUCKET = os.environ.get("UPLOAD_BUCKET", "ecolens-uploads-288515363084")
THUMBNAIL_BUCKET = os.environ.get("THUMBNAIL_BUCKET", "ecolens-thumbnails-288515363084")


def build_response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "DELETE,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        "body": json.dumps(body),
    }


def lambda_handler(event, context):
    """
    Delete a file: remove from S3 (original + thumbnail) and DynamoDB.

    Request body:
    {
        "file_url": "https://bucket.s3.amazonaws.com/user/file.jpg"
    }

    Or query parameter:
        ?file_url=https://bucket.s3.amazonaws.com/user/file.jpg
    """
    try:
        # Get file_url from body or query params
        body = json.loads(event.get("body", "{}")) if event.get("body") else {}
        params = event.get("queryStringParameters", {}) or {}
        file_url = body.get("file_url") or params.get("file_url")

        if not file_url:
            return build_response(400, {"error": "file_url is required"})

        table = dynamodb.Table(FILES_TABLE)

        # Get DynamoDB record first
        response = table.get_item(Key={"file_url": file_url})
        item = response.get("Item")

        if not item:
            return build_response(404, {"error": "File not found"})

        # Extract S3 key from URL
        # URL format: https://bucket.s3.amazonaws.com/key
        s3_key = file_url.split(f"{UPLOAD_BUCKET}.s3.amazonaws.com/")[1]

        # Delete original file from S3
        try:
            s3_client.delete_object(Bucket=UPLOAD_BUCKET, Key=s3_key)
            print(f"Deleted from uploads: {s3_key}")
        except Exception as e:
            print(f"Warning: could not delete upload {s3_key}: {e}")

        # Delete thumbnail from S3 if exists
        thumbnail_url = item.get("thumbnail_url")
        if thumbnail_url and THUMBNAIL_BUCKET in thumbnail_url:
            thumb_key = thumbnail_url.split(
                f"{THUMBNAIL_BUCKET}.s3.amazonaws.com/"
            )[1]
            try:
                s3_client.delete_object(Bucket=THUMBNAIL_BUCKET, Key=thumb_key)
                print(f"Deleted thumbnail: {thumb_key}")
            except Exception as e:
                print(f"Warning: could not delete thumbnail {thumb_key}: {e}")

        # Delete DynamoDB record
        table.delete_item(Key={"file_url": file_url})
        print(f"Deleted DynamoDB record: {file_url}")

        return build_response(200, {
            "message": "File deleted successfully",
            "file_url": file_url,
        })

    except Exception as e:
        print(f"Error: {str(e)}")
        return build_response(500, {"error": str(e)})
