"""
File Manager Lambda Function

Bulk deletion of files: removes S3 objects and DynamoDB records.

Request body (rubric format — list of URLs):
{
    "urls": ["https://...file1.jpg", "https://...file2.jpg"]
}

Legacy single-file format also supported:
{
    "file_url": "https://...file.jpg"
}
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


def delete_single(table, file_url):
    """
    Delete one file: S3 original + S3 thumbnail + DynamoDB record.
    Returns "deleted", "not_found", or "error".
    """
    response = table.get_item(Key={"file_url": file_url})
    item = response.get("Item")
    if not item:
        return "not_found"

    # Delete original from S3
    try:
        key = file_url.split(f"{UPLOAD_BUCKET}.s3.amazonaws.com/")[1]
        s3_client.delete_object(Bucket=UPLOAD_BUCKET, Key=key)
    except Exception as e:
        print(f"Warning: could not delete upload {file_url}: {e}")

    # Delete thumbnail from S3
    thumbnail_url = item.get("thumbnail_url", "")
    if thumbnail_url and THUMBNAIL_BUCKET in thumbnail_url:
        try:
            thumb_key = thumbnail_url.split(f"{THUMBNAIL_BUCKET}.s3.amazonaws.com/")[1]
            s3_client.delete_object(Bucket=THUMBNAIL_BUCKET, Key=thumb_key)
        except Exception as e:
            print(f"Warning: could not delete thumbnail {thumbnail_url}: {e}")

    # Delete video frames from S3 if this is a video
    if item.get("file_type") == "video":
        try:
            base_key = file_url.split(f"{UPLOAD_BUCKET}.s3.amazonaws.com/")[1]
            prefix = base_key.rsplit(".", 1)[0]
            paginator = s3_client.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=UPLOAD_BUCKET, Prefix=prefix + "_frame_"):
                for obj in page.get("Contents", []):
                    s3_client.delete_object(Bucket=UPLOAD_BUCKET, Key=obj["Key"])
        except Exception as e:
            print(f"Warning: could not delete video frames: {e}")

    # Delete DynamoDB record
    table.delete_item(Key={"file_url": file_url})
    return "deleted"


def lambda_handler(event, context):
    try:
        body = {}
        if isinstance(event, dict):
            if "body" in event:
                raw = event["body"]
                body = json.loads(raw) if isinstance(raw, str) else (raw or {})
            elif "body-json" in event:
                raw = event["body-json"]
                body = json.loads(raw) if isinstance(raw, str) else (raw or {})
            else:
                body = event

        params = event.get("queryStringParameters", {}) or {} if isinstance(event, dict) else {}

        # Resolve URL list — rubric: "urls" list; legacy: "file_url" single
        urls = body.get("urls") or []
        if not urls and body.get("file_url"):
            urls = [body["file_url"]]
        if not urls and params.get("file_url"):
            urls = [params["file_url"]]
        if not urls:
            return build_response(400, {"error": "urls (list) or file_url is required"})

        table = dynamodb.Table(FILES_TABLE)
        deleted = []
        not_found = []

        for url in urls:
            result = delete_single(table, url)
            if result == "deleted":
                deleted.append(url)
            else:
                not_found.append(url)

        return build_response(200, {
            "message": f"Deleted {len(deleted)} file(s)",
            "deleted": deleted,
            "not_found": not_found,
        })

    except Exception as e:
        print(f"Error: {str(e)}")
        return build_response(500, {"error": str(e)})
