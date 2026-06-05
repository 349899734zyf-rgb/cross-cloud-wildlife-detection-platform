"""
Notification Lambda — GCP Proxy

Receives {file_url, tags} from ml_tagger,
forwards to GCP Cloud Run /notify which:
  1. Queries GCP Firestore for subscribers of each species
  2. Sends email via SendGrid to each subscriber
"""

import json
import os
import urllib.request
import urllib.error

GCP_NOTIFY_URL = os.environ.get(
    "GCP_NOTIFY_URL",
    "https://aws-cognito-authenticator-524389055136.us-central1.run.app/notify"
)

CORS = {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}


def build_response(status_code, body):
    return {"statusCode": status_code, "headers": CORS, "body": json.dumps(body)}


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

        # Forward to GCP Cloud Run → Firestore lookup → SendGrid email
        payload = json.dumps({"file_url": file_url, "tags": tags}).encode("utf-8")
        req = urllib.request.Request(
            GCP_NOTIFY_URL,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode())
            print(f"GCP notified: {result}")
            return build_response(200, result)

    except urllib.error.URLError as e:
        print(f"GCP notify failed: {e}")
        return build_response(200, {"notified": 0, "error": str(e)})
    except Exception as e:
        print(f"Error: {e}")
        return build_response(500, {"error": str(e)})
