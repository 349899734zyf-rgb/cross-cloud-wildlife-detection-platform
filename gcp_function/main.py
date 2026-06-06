"""
GCP Cloud Function — EcoLens Notification Service

Handles:
  - JWT verification (from AWS Cognito)
  - Tag subscription management (stored in GCP Firestore)
  - Email notifications when species are detected (via SendGrid)
  - Called by AWS ml_tagger after ML tagging completes

Routes (all require Authorization: Bearer <CognitoJWT> except /notify):
  POST   /subscribe   — subscribe to a species tag
  DELETE /subscribe   — unsubscribe from a species tag
  GET    /subscribe   — list subscriptions for a user
  POST   /notify      — internal: called by AWS Lambda to trigger emails
"""

import json
import os
import jwt
import requests
from jwt.algorithms import RSAAlgorithm
from google.cloud import firestore

# ── Cognito config ────────────────────────────────────────────────────────────
AWS_REGION = "us-east-1"
USER_POOL_ID = "us-east-1_jijBmZk13"
APP_CLIENT_ID = "1n6j3vvt3gahq48sl969fhdmls"
COGNITO_JWKS_URL = f"https://cognito-idp.{AWS_REGION}.amazonaws.com/{USER_POOL_ID}/.well-known/jwks.json"
EXPECTED_ISSUER = f"https://cognito-idp.{AWS_REGION}.amazonaws.com/{USER_POOL_ID}"

# ── SendGrid config ───────────────────────────────────────────────────────────
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "noreply@aussie-ecolens.app")

# ── Firestore ─────────────────────────────────────────────────────────────────
db = firestore.Client()
SUBSCRIPTIONS_COL = "subscriptions"  # document id: {user_id}_{tag_name}

# ── JWKS cache ────────────────────────────────────────────────────────────────
cached_jwks = None

# ── CORS headers ─────────────────────────────────────────────────────────────
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
}


def cors_preflight():
    return ("", 204, CORS)


def json_response(status, body):
    return (json.dumps(body), status, {**CORS, "Content-Type": "application/json"})


# ── JWT verification ──────────────────────────────────────────────────────────

def get_jwks():
    global cached_jwks
    if not cached_jwks:
        resp = requests.get(COGNITO_JWKS_URL, timeout=5)
        resp.raise_for_status()
        cached_jwks = resp.json()
    return cached_jwks


def verify_token(token):
    try:
        headers = jwt.get_unverified_header(token)
        kid = headers.get("kid")
        jwks = get_jwks()
        public_key = None
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                public_key = RSAAlgorithm.from_jwk(json.dumps(key))
                break
        if not public_key:
            return None, "Public key not found"
        decoded = jwt.decode(
            token, public_key,
            algorithms=["RS256"],
            audience=APP_CLIENT_ID,
            issuer=EXPECTED_ISSUER,
        )
        return decoded, None
    except jwt.ExpiredSignatureError:
        return None, "Token expired"
    except Exception as e:
        return None, str(e)


def get_claims(request):
    """Extract and verify Cognito JWT, return claims or None."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None, "Missing token"
    token = auth.split(" ", 1)[1]
    return verify_token(token)


# ── Firestore helpers ─────────────────────────────────────────────────────────

def doc_id(user_id, tag_name):
    return f"{user_id}__{tag_name}"


def subscribe_user(user_id, email, tag_name):
    db.collection(SUBSCRIPTIONS_COL).document(doc_id(user_id, tag_name)).set({
        "user_id": user_id,
        "email": email,
        "tag_name": tag_name,
    })


def unsubscribe_user(user_id, tag_name):
    db.collection(SUBSCRIPTIONS_COL).document(doc_id(user_id, tag_name)).delete()


def get_subscriptions(user_id):
    docs = db.collection(SUBSCRIPTIONS_COL).where("user_id", "==", user_id).stream()
    return [d.to_dict() for d in docs]


def get_subscribers_for_tag(tag_name):
    docs = db.collection(SUBSCRIPTIONS_COL).where("tag_name", "==", tag_name).stream()
    return [d.to_dict() for d in docs]


# ── Email via SendGrid ────────────────────────────────────────────────────────

def send_email(to_email, species, file_url, all_tags):
    if not SENDGRID_API_KEY:
        print(f"[NOTIFY] No SendGrid key — would email {to_email} about {species}")
        return

    body = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": SENDER_EMAIL, "name": "AussieEcoLens"},
        "subject": f"EcoLens Alert: {species} detected!",
        "content": [{
            "type": "text/plain",
            "value": (
                f"Hi,\n\n"
                f"A new file containing {species} has been uploaded to AussieEcoLens.\n\n"
                f"File URL: {file_url}\n"
                f"All detected species: {json.dumps(all_tags, indent=2)}\n\n"
                f"Log in to view the file.\n\n"
                f"— AussieEcoLens Team"
            )
        }]
    }
    resp = requests.post(
        "https://api.sendgrid.com/v3/mail/send",
        headers={"Authorization": f"Bearer {SENDGRID_API_KEY}", "Content-Type": "application/json"},
        json=body,
        timeout=10,
    )
    print(f"[NOTIFY] SendGrid response {resp.status_code} for {to_email}")


# ── Main entry point ──────────────────────────────────────────────────────────

def handle_request(request):
    if request.method == "OPTIONS":
        return cors_preflight()

    path = request.path.rstrip("/")
    method = request.method

    # ── GET /subscribers — internal, called by AWS notification Lambda ──────
    # Returns subscriber emails for a given tag (no auth, internal only)
    if path.endswith("/subscribers") and method == "GET":
        tag = request.args.get("tag", "")
        if not tag:
            return json_response(400, {"error": "tag parameter required"})
        subs = get_subscribers_for_tag(tag)
        emails = [s["email"] for s in subs if s.get("email")]
        return json_response(200, {"emails": emails, "count": len(emails)})

    # ── POST /notify — called by AWS notification Lambda (no auth required) ──
    if path.endswith("/notify") and method == "POST":
        data = request.get_json(silent=True) or {}
        tags = data.get("tags", {})
        file_url = data.get("file_url", "")
        total = 0
        for tag_name in tags.keys():
            subscribers = get_subscribers_for_tag(tag_name)
            for sub in subscribers:
                send_email(sub["email"], tag_name, file_url, tags)
                total += 1
        return json_response(200, {"notified": total})

    # ── All other routes require valid Cognito JWT ─────────────────────────
    claims, err = get_claims(request)
    if not claims:
        return json_response(401, {"error": f"Unauthorized: {err}"})

    user_id = claims.get("sub", "unknown")
    user_email = claims.get("email", "")

    # ── GET /subscribe — list subscriptions ───────────────────────────────
    if path.endswith("/subscribe") and method == "GET":
        subs = get_subscriptions(user_id)
        return json_response(200, {"subscriptions": subs, "count": len(subs)})

    # ── POST /subscribe — subscribe to a tag ─────────────────────────────
    if path.endswith("/subscribe") and method == "POST":
        body = request.get_json(silent=True) or {}
        tag_name = body.get("tag_name")
        email = body.get("email") or user_email
        if not tag_name:
            return json_response(400, {"error": "tag_name is required"})
        subscribe_user(user_id, email, tag_name)
        return json_response(200, {"message": f"Subscribed to {tag_name}", "tag_name": tag_name})

    # ── DELETE /subscribe — unsubscribe ──────────────────────────────────
    if path.endswith("/subscribe") and method == "DELETE":
        body = request.get_json(silent=True) or {}
        tag_name = body.get("tag_name")
        if not tag_name:
            return json_response(400, {"error": "tag_name is required"})
        unsubscribe_user(user_id, tag_name)
        return json_response(200, {"message": f"Unsubscribed from {tag_name}"})

    return json_response(404, {"error": f"Unknown route: {method} {path}"})
