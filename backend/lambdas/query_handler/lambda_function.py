"""
Query Handler Lambda Function

Supports 4 query types:
1. By tags + count: find files matching species with minimum count
2. By species: find files containing specific species
3. By thumbnail URL: find original file from thumbnail
4. By file: upload temp file, run ML, find matching results
"""

import json
import os
import boto3
import base64
import uuid
import email
from boto3.dynamodb.conditions import Attr

dynamodb = boto3.resource("dynamodb")
s3_client = boto3.client("s3")

FILES_TABLE = os.environ.get("FILES_TABLE", "ecolens-files")
UPLOAD_BUCKET = os.environ.get("UPLOAD_BUCKET", "ecolens-uploads-288515363084")


def build_response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        "body": json.dumps(body),
    }


def query_by_tags(tags_filter):
    """
    Find files where each specified species count >= requested count.

    Args:
        tags_filter: dict like {"koala": 3, "wombat": 2}

    Returns:
        list of matching file records
    """
    table = dynamodb.Table(FILES_TABLE)

    # Build filter expression for all tag conditions (AND logic)
    filter_parts = []
    expr_values = {}
    expr_names = {}

    for i, (species, min_count) in enumerate(tags_filter.items()):
        attr_key = f"#tag{i}"
        val_key = f":count{i}"
        expr_names[attr_key] = species
        expr_values[val_key] = int(min_count)
        filter_parts.append(
            f"attribute_exists(tags.{attr_key}) AND tags.{attr_key} >= {val_key}"
        )

    filter_expr = " AND ".join(filter_parts)

    # Scan with filter (DynamoDB scan is acceptable for small datasets)
    scan_kwargs = {
        "FilterExpression": filter_expr,
        "ExpressionAttributeNames": expr_names,
        "ExpressionAttributeValues": expr_values,
    }

    results = []
    response = table.scan(**scan_kwargs)
    results.extend(response.get("Items", []))

    # Handle pagination
    while "LastEvaluatedKey" in response:
        scan_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]
        response = table.scan(**scan_kwargs)
        results.extend(response.get("Items", []))

    return results


def query_by_thumbnail(thumbnail_url):
    """
    Find original file URL from thumbnail URL using GSI.
    """
    table = dynamodb.Table(FILES_TABLE)
    result = table.query(
        IndexName="thumbnail-index",
        KeyConditionExpression="thumbnail_url = :url",
        ExpressionAttributeValues={":url": thumbnail_url},
    )
    return result.get("Items", [])


def query_by_file(event):
    """
    Accept uploaded file, run ML inference to get tags,
    then query database for matching files.
    The uploaded file is NOT stored in the database.

    Note: This function invokes the ML tagger Lambda for inference.
    """
    try:
        # 1. Extract file bytes from API Gateway multipart/form-data request
        is_base64_encoded = event.get("isBase64Encoded", False)
        body_str = event.get("body", "")
        
        if not body_str:
            print("Empty request body")
            return []
            
        body_bytes = base64.b64decode(body_str) if is_base64_encoded else (
            body_str.encode('utf-8') if isinstance(body_str, str) else body_str
        )

        headers = event.get("headers", {}) or {}
        content_type = next((headers[h] for h in headers if h.lower() == "content-type"), "")
        
        if "boundary=" not in content_type:
            print("Content-Type is not multipart/form-data or lacks boundary")
            return []

        # Parse multipart body using email standard library parser
        mime_message = f"Content-Type: {content_type}\r\n\r\n".encode('utf-8') + body_bytes
        msg = email.message_from_bytes(mime_message)
        
        file_bytes = None
        file_name = None
        
        if msg.is_multipart():
            for part in msg.walk():
                filename = part.get_filename()
                if filename:
                    file_bytes = part.get_payload(decode=True)
                    file_name = filename
                    break
                    
        if not file_bytes:
            print("No file bytes extracted from multipart request")
            return []

        # 2. Generate a temp key and upload to S3
        temp_id = uuid.uuid4().hex
        ext = os.path.splitext(file_name)[1].lower() if file_name else ".jpg"
        temp_key = f"temp_query/{temp_id}{ext}"
        temp_file_url = f"https://{UPLOAD_BUCKET}.s3.amazonaws.com/{temp_key}"
        
        print(f"Uploading temporary file for query: {temp_key}")
        s3_client.put_object(
            Bucket=UPLOAD_BUCKET,
            Key=temp_key,
            Body=file_bytes,
            ContentType="image/jpeg"
        )

        # 3. Create a temporary record in DynamoDB (ml_tagger needs this to run update_item)
        table = dynamodb.Table(FILES_TABLE)
        table.put_item(Item={
            "file_url": temp_file_url,
            "tags": {},
            "file_name": file_name or f"temp_{temp_id}{ext}",
            "upload_time": "temp"
        })

        # 4. Synchronously invoke ml_tagger Lambda (FunctionName="ecolens-ml-tagger")
        lambda_client = boto3.client("lambda")
        detected_tags = {}
        
        try:
            print(f"Invoking ecolens-ml-tagger for temp key: {temp_key}")
            lambda_client.invoke(
                FunctionName="ecolens-ml-tagger",
                InvocationType="RequestResponse",
                Payload=json.dumps({
                    "Records": [
                        {
                            "s3": {
                                "bucket": {"name": UPLOAD_BUCKET},
                                "object": {"key": temp_key}
                            }
                        }
                    ]
                })
            )
            
            # Read the updated tags back from DynamoDB
            response = table.get_item(Key={"file_url": temp_file_url})
            item = response.get("Item", {})
            detected_tags = item.get("tags", {})
            print(f"ML Tagger identified tags for query file: {detected_tags}")
            
        except Exception as invoke_err:
            print(f"Error invoking ML tagger: {str(invoke_err)}")
        finally:
            # Clean up: delete temp DynamoDB record and S3 file
            try:
                print(f"Cleaning up temporary resources for query: {temp_key}")
                table.delete_item(Key={"file_url": temp_file_url})
                s3_client.delete_object(Bucket=UPLOAD_BUCKET, Key=temp_key)
            except Exception as cleanup_err:
                print(f"Failed to clean up temporary resources: {str(cleanup_err)}")

        # 5. Query matching files from DynamoDB using the detected tags
        if not detected_tags:
            print("No tags detected, returning empty results")
            return []
            
        return query_by_tags(detected_tags)

    except Exception as e:
        print(f"Error in query_by_file: {str(e)}")
        return []


def lambda_handler(event, context):
    """
    Main handler. Routes to appropriate query function based on path.
    """
    try:
        path = event.get("path", "")
        method = event.get("httpMethod", "")

        print(f"Query request: {method} {path}")

        if path.endswith("/query/tags") or path.endswith("/query/species"):
            body = json.loads(event.get("body", "{}"))

            if path.endswith("/query/species"):
                # Convert species-only query to tags query with count=1
                species_list = body.get("species", [])
                body = {s: 1 for s in species_list}

            if not body:
                return build_response(400, {"error": "Query tags are required"})

            results = query_by_tags(body)
            return build_response(200, {
                "count": len(results),
                "results": results,
            })

        elif path.endswith("/query/thumbnail"):
            params = event.get("queryStringParameters", {}) or {}
            url = params.get("url")

            if not url:
                return build_response(400, {"error": "url parameter is required"})

            results = query_by_thumbnail(url)
            return build_response(200, {
                "count": len(results),
                "results": results,
            })

        elif path.endswith("/query/file"):
            results = query_by_file(event)
            return build_response(200, {
                "count": len(results),
                "results": results,
            })

        else:
            return build_response(404, {"error": f"Unknown query path: {path}"})

    except Exception as e:
        print(f"Error: {str(e)}")
        return build_response(500, {"error": str(e)})
