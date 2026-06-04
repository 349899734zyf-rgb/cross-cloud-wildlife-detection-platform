"""
Notification Lambda Function

Handles tag subscription management and sends SNS notifications
when files matching subscribed tags are uploaded.
"""

import json
import os
import boto3

dynamodb = boto3.resource("dynamodb")
sns_client = boto3.client("sns")

SUBSCRIPTIONS_TABLE = os.environ.get("SUBSCRIPTIONS_TABLE", "ecolens-subscriptions")
SNS_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN", "")


def build_response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST,DELETE,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        "body": json.dumps(body),
    }


def subscribe(user_id, user_email, tag_name):
    """
    Subscribe a user to notifications for a specific tag/species.
    """
    table = dynamodb.Table(SUBSCRIPTIONS_TABLE)

    table.put_item(Item={
        "user_id": user_id,
        "tag_name": tag_name,
        "email": user_email,
    })

    # Programmatically subscribe the email to the SNS Topic with a filter policy
    # so they only receive notifications intended for their email address.
    if SNS_TOPIC_ARN:
        try:
            sns_client.subscribe(
                TopicArn=SNS_TOPIC_ARN,
                Protocol="email",
                Endpoint=user_email,
                Attributes={
                    "FilterPolicy": json.dumps({"email": [user_email]})
                }
            )
            print(f"SNS subscription request sent for {user_email}")
        except Exception as e:
            print(f"Warning: Failed to subscribe {user_email} to SNS topic: {e}")

    return {"message": f"Subscribed to '{tag_name}'", "tag_name": tag_name}


def unsubscribe(user_id, tag_name):
    """
    Remove a subscription.
    """
    table = dynamodb.Table(SUBSCRIPTIONS_TABLE)

    table.delete_item(Key={
        "user_id": user_id,
        "tag_name": tag_name,
    })

    return {"message": f"Unsubscribed from '{tag_name}'", "tag_name": tag_name}


def get_subscriptions(user_id):
    """
    Get all subscriptions for a user.
    """
    table = dynamodb.Table(SUBSCRIPTIONS_TABLE)
    response = table.query(
        KeyConditionExpression="user_id = :uid",
        ExpressionAttributeValues={":uid": user_id},
    )
    return response.get("Items", [])


def notify_subscribers(tag_name, file_url, tags):
    """
    Send SNS notification to all users subscribed to this tag.
    Called by the ML tagger Lambda after tagging completes.
    """
    table = dynamodb.Table(SUBSCRIPTIONS_TABLE)

    # Query GSI to find all subscribers for this tag
    response = table.query(
        IndexName="tag-subscribers",
        KeyConditionExpression="tag_name = :t",
        ExpressionAttributeValues={":t": tag_name},
    )

    subscribers = response.get("Items", [])
    if not subscribers:
        return {"notified": 0}

    # Build notification message
    message = (
        f"New wildlife detection!\n\n"
        f"Species: {tag_name}\n"
        f"File: {file_url}\n"
        f"All detected species: {json.dumps(tags)}"
    )

    # Send via SNS
    if SNS_TOPIC_ARN:
        for sub in subscribers:
            try:
                sns_client.publish(
                    TopicArn=SNS_TOPIC_ARN,
                    Subject=f"EcoLens Alert: {tag_name} detected",
                    Message=message,
                    MessageAttributes={
                        "email": {
                            "DataType": "String",
                            "StringValue": sub.get("email", ""),
                        },
                    },
                )
            except Exception as e:
                print(f"Failed to notify {sub.get('email')}: {e}")

    return {"notified": len(subscribers)}


def lambda_handler(event, context):
    """
    Main handler. Routes based on HTTP method and action.
    """
    try:
        method = event.get("httpMethod", "") if isinstance(event, dict) else ""
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

        # Internal invocation from ML tagger (not via API Gateway)
        # Handles both:
        #   new format: {"action": "notify", "file_url": ..., "tags": {...}}
        #   legacy format: {"file_url": ..., "user_id": ..., "tags": {...}}
        is_notify_call = (
            (body.get("action") == "notify") or
            ("tags" in body and "file_url" in body and not method)
        )
        if is_notify_call:
            tags = body.get("tags", {})
            file_url = body.get("file_url", "")
            total_notified = 0
            for tag_name in tags.keys():
                result = notify_subscribers(tag_name, file_url, tags)
                total_notified += result.get("notified", 0)
            return build_response(200, {"notified": total_notified})

        params = event.get("queryStringParameters", {}) or {}
        user_id = body.get("user_id") or params.get("user_id")
        if not user_id:
            return build_response(400, {"error": "user_id is required"})

        if method == "POST":
            tag_name = body.get("tag_name")
            user_email = body.get("email")
            if not tag_name or not user_email:
                return build_response(400, {
                    "error": "tag_name and email are required"
                })
            result = subscribe(user_id, user_email, tag_name)
            return build_response(200, result)

        elif method == "DELETE":
            tag_name = body.get("tag_name")
            if not tag_name:
                return build_response(400, {"error": "tag_name is required"})
            result = unsubscribe(user_id, tag_name)
            return build_response(200, result)

        elif method == "GET":
            subs = get_subscriptions(user_id)
            return build_response(200, {
                "subscriptions": subs,
                "count": len(subs),
            })

        else:
            return build_response(405, {"error": f"Method {method} not allowed"})

    except Exception as e:
        print(f"Error: {str(e)}")
        return build_response(500, {"error": str(e)})
