"""
Tag Manager Lambda Function

Handles adding and removing tags for uploaded files.
Updates the tags field in DynamoDB.
"""

import json
import os
import boto3

dynamodb = boto3.resource("dynamodb")

FILES_TABLE = os.environ.get("FILES_TABLE", "ecolens-files")


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
    Add or remove tags for a file.

    Request body:
    {
        "file_url": "https://bucket.s3.amazonaws.com/user/file.jpg",
        "action": "add" or "remove",
        "tags": {"koala": 2, "wombat": 1}
    }
    """
    try:
        # Robust body parsing for both API Gateway Proxy Integration and Non-Proxy Integration
        body = {}
        if isinstance(event, dict):
            if "body" in event:
                body_raw = event["body"]
                body = json.loads(body_raw) if isinstance(body_raw, str) else (body_raw or {})
            elif "body-json" in event:
                body_raw = event["body-json"]
                body = json.loads(body_raw) if isinstance(body_raw, str) else (body_raw or {})
            else:
                body = event

        file_url = body.get("file_url") if isinstance(body, dict) else None
        action = body.get("action") if isinstance(body, dict) else None
        tags = body.get("tags", {}) if isinstance(body, dict) else {}

        if not file_url:
            return build_response(400, {"error": "file_url is required"})
        if action not in ("add", "remove"):
            return build_response(400, {"error": "action must be 'add' or 'remove'"})
        if not tags:
            return build_response(400, {"error": "tags are required"})

        table = dynamodb.Table(FILES_TABLE)

        # Get current record
        response = table.get_item(Key={"file_url": file_url})
        item = response.get("Item")
        if not item:
            return build_response(404, {"error": "File not found"})

        current_tags = item.get("tags", {})

        if action == "add":
            for species, count in tags.items():
                current_count = int(current_tags.get(species, 0))
                current_tags[species] = current_count + int(count)

        elif action == "remove":
            for species, count in tags.items():
                if species in current_tags:
                    new_count = int(current_tags[species]) - int(count)
                    if new_count <= 0:
                        del current_tags[species]
                    else:
                        current_tags[species] = new_count

        # Update DynamoDB
        table.update_item(
            Key={"file_url": file_url},
            UpdateExpression="SET tags = :t",
            ExpressionAttributeValues={":t": current_tags},
        )

        return build_response(200, {
            "message": f"Tags {action}ed successfully",
            "file_url": file_url,
            "tags": current_tags,
        })

    except Exception as e:
        print(f"Error: {str(e)}")
        return build_response(500, {"error": str(e)})
