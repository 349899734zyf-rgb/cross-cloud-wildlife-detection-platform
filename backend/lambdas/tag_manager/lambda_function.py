"""
Tag Manager Lambda Function

Bulk addition or removal of tags across multiple files.

Request body (rubric format):
{
    "urls": ["https://...file1.jpg", "https://...file2.jpg"],
    "tags": {"Felis_catus": 2, "Canis_dingo": 1},
    "operation": 1   (1 = add, 0 = remove)
}

Legacy single-file format also supported:
{
    "file_url": "https://...file.jpg",
    "action": "add" or "remove",
    "tags": {"Felis_catus": 2}
}
"""

import json
import os
import boto3
from decimal import Decimal

dynamodb = boto3.resource("dynamodb")
FILES_TABLE = os.environ.get("FILES_TABLE", "ecolens-files")


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super().default(obj)


def build_response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        "body": json.dumps(body, cls=DecimalEncoder),
    }


def update_tags_for_url(table, file_url, tags, action):
    """
    Add or remove tags for a single file URL.
    Returns updated tags dict or None if file not found.
    """
    response = table.get_item(Key={"file_url": file_url})
    item = response.get("Item")
    if not item:
        return None

    current_tags = dict(item.get("tags", {}))

    if action == "add":
        for species, count in tags.items():
            current_tags[species] = int(current_tags.get(species, 0)) + int(count)
        # If adding real species tags, remove the unknown fallback
        if any(s != "unknown" for s in tags.keys()):
            current_tags.pop("unknown", None)
    else:  # remove
        for species in tags.keys():
            # Ignore tags not present — as per assignment spec
            if species in current_tags:
                new_count = int(current_tags[species]) - int(tags[species])
                if new_count <= 0:
                    del current_tags[species]
                else:
                    current_tags[species] = new_count
        # If all tags removed, fall back to unknown so the file stays searchable
        if not current_tags:
            current_tags = {"unknown": 1}

    table.update_item(
        Key={"file_url": file_url},
        UpdateExpression="SET tags = :t",
        ExpressionAttributeValues={":t": current_tags},
    )
    return current_tags


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

        tags = body.get("tags", {})
        if not tags:
            return build_response(400, {"error": "tags are required"})

        # --- Resolve action ---
        # Rubric format: operation 1 = add, 0 = remove
        # Legacy format: action "add" / "remove"
        if "operation" in body:
            op = body["operation"]
            if op not in (0, 1):
                return build_response(400, {"error": "operation must be 0 (remove) or 1 (add)"})
            action = "add" if op == 1 else "remove"
        elif "action" in body:
            action = body["action"]
            if action not in ("add", "remove"):
                return build_response(400, {"error": "action must be 'add' or 'remove'"})
        else:
            return build_response(400, {"error": "operation (0/1) or action (add/remove) is required"})

        # --- Resolve URL list ---
        # Rubric format: urls (list)
        # Legacy format: file_url (single string)
        urls = body.get("urls") or []
        if not urls and body.get("file_url"):
            urls = [body["file_url"]]
        if not urls:
            return build_response(400, {"error": "urls (list) or file_url is required"})

        table = dynamodb.Table(FILES_TABLE)
        results = []
        not_found = []

        for url in urls:
            updated = update_tags_for_url(table, url, tags, action)
            if updated is None:
                not_found.append(url)
            else:
                results.append({"file_url": url, "tags": updated})

        return build_response(200, {
            "message": f"Tags {action}ed for {len(results)} file(s)",
            "updated": results,
            "not_found": not_found,
        })

    except Exception as e:
        print(f"Error: {str(e)}")
        return build_response(500, {"error": str(e)})
