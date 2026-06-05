"""
Notification Lambda

1. Receives {file_url, tags} from ml_tagger
2. Queries GCP Firestore (via Cloud Run) for subscriber emails per tag
3. Subscribes each email to AWS SNS topic (sends confirm email if first time)
4. Publishes notification to SNS → confirmed subscribers receive email
"""

import json
import os
import urllib.request
import urllib.parse
import boto3

GCP_BASE_URL = os.environ.get(
    "GCP_BASE_URL",
    "https://aws-cognito-authenticator-524389055136.us-central1.run.app"
)
SNS_TOPIC_ARN = os.environ.get(
    "SNS_TOPIC_ARN",
    "arn:aws:sns:us-east-1:288515363084:ecolens-tag-alerts"
)

sns_client = boto3.client("sns", region_name="us-east-1")
CORS = {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}


def build_response(status_code, body):
    return {"statusCode": status_code, "headers": CORS, "body": json.dumps(body)}


def get_subscribers_from_gcp(tag_name):
    """Query GCP Firestore via Cloud Run for subscriber emails."""
    url = f"{GCP_BASE_URL}/subscribers?tag={urllib.parse.quote(tag_name)}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
            return data.get("emails", [])
    except Exception as e:
        print(f"[GCP] Failed to get subscribers for {tag_name}: {e}")
        return []


def ensure_sns_subscription(email):
    """
    Subscribe email to SNS topic.
    First call: SNS sends confirmation email to user.
    Subsequent calls: idempotent, no duplicate email.
    """
    try:
        sns_client.subscribe(
            TopicArn=SNS_TOPIC_ARN,
            Protocol="email",
            Endpoint=email,
            ReturnSubscriptionArn=False,
        )
        print(f"[SNS] Subscription requested for {email}")
    except Exception as e:
        print(f"[SNS] Subscribe failed for {email}: {e}")


def publish_to_sns(tag_name, file_url, all_tags):
    """Publish notification to SNS — all confirmed subscribers receive it."""
    species_list = ", ".join(all_tags.keys())
    message = (
        f"New wildlife detection on AussieEcoLens!\n\n"
        f"Species: {tag_name}\n"
        f"File: {file_url}\n"
        f"All species in this file: {species_list}\n\n"
        f"View at: https://aussie-ecolens-frontend-524389055136.us-central1.run.app"
    )
    try:
        sns_client.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject=f"EcoLens Alert: {tag_name} detected!",
            Message=message,
        )
        print(f"[SNS] Published notification for {tag_name}")
    except Exception as e:
        print(f"[SNS] Publish failed: {e}")


def lambda_handler(event, _context):
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

        is_notify = (
            body.get("action") == "notify" or
            ("tags" in body and "file_url" in body and not event.get("httpMethod"))
        )
        if not is_notify:
            return build_response(400, {"error": "Not a notification request"})

        file_url = body.get("file_url", "")
        tags = body.get("tags", {})

        if not tags:
            return build_response(200, {"notified": 0})

        total_notified = 0

        for tag_name in tags.keys():
            # 1. Get subscriber emails from GCP Firestore
            emails = get_subscribers_from_gcp(tag_name)
            if not emails:
                print(f"[INFO] No subscribers for {tag_name}")
                continue

            # 2. Subscribe each email to SNS (sends confirm email if first time)
            for email in emails:
                ensure_sns_subscription(email)

            # 3. Publish to SNS — confirmed subscribers get the email
            publish_to_sns(tag_name, file_url, tags)
            total_notified += len(emails)
            print(f"[INFO] Notified {len(emails)} subscriber(s) for {tag_name}")

        return build_response(200, {"notified": total_notified})

    except Exception as e:
        print(f"Error: {e}")
        return build_response(500, {"error": str(e)})
