"""
GCP Cloud Function – Cognito Token Authenticator & Secondary Processing

Verifies the AWS Cognito ID/Access Token sent from the React frontend.
Fulfills the multi-cloud authentication and processing requirement.
"""

import json
import jwt
import requests
from jwt.algorithms import RSAAlgorithm

# Configuration (In production, load these from GCP Secret Manager or Environment Variables)
AWS_REGION = "us-east-1"
USER_POOL_ID = "us-east-1_jijBmZk13"
APP_CLIENT_ID = "1n6j3vvt3gahq48sl969fhdmls"

COGNITO_JWKS_URL = f"https://cognito-idp.{AWS_REGION}.amazonaws.com/{USER_POOL_ID}/.well-known/jwks.json"
EXPECTED_ISSUER = f"https://cognito-idp.{AWS_REGION}.amazonaws.com/{USER_POOL_ID}"

# Cache JWKS keys in memory across invocations
cached_jwks = None

def get_jwks():
    global cached_jwks
    if cached_jwks is None:
        try:
            response = requests.get(COGNITO_JWKS_URL, timeout=5)
            response.raise_for_status()
            cached_jwks = response.json()
        except Exception as e:
            print(f"Error fetching JWKS from Cognito: {e}")
            raise e
    return cached_jwks

def verify_token(token):
    """
    Decodes and validates the AWS Cognito JWT Token using Cognito JWKS.
    """
    try:
        # 1. Unverified header to find kid
        headers = jwt.get_unverified_header(token)
        kid = headers.get("kid")
        if not kid:
            return False, "Token missing 'kid' header claim"

        # 2. Get Cognito Public Keys
        jwks = get_jwks()
        public_key = None
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                public_key = RSAAlgorithm.from_jwk(json.dumps(key))
                break

        if not public_key:
            return False, "Public key not found for matching 'kid'"

        # 3. Decode and verify signature & claims
        decoded = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=APP_CLIENT_ID,
            issuer=EXPECTED_ISSUER,
            options={"verify_aud": True, "verify_iss": True, "verify_exp": True}
        )
        return True, decoded

    except jwt.ExpiredSignatureError:
        return False, "Token has expired"
    except jwt.InvalidIssuerError:
        return False, "Token has invalid issuer"
    except jwt.InvalidAudienceError:
        return False, "Token has invalid audience"
    except Exception as e:
        return False, f"Token verification failed: {str(e)}"

def handle_request(request):
    """
    Entry point for GCP Cloud Function (HTTP Trigger).
    """
    # Enable CORS
    if request.method == "OPTIONS":
        headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "3600"
        }
        return ("", 204, headers)

    headers = {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
    }

    # Extract Authorization Header
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return (json.dumps({"error": "Unauthorized: Missing or invalid Authorization header"}), 401, headers)

    token = auth_header.split(" ")[1]

    # Verify Token
    success, result = verify_token(token)
    if not success:
        return (json.dumps({"error": f"Unauthorized: {result}"}), 401, headers)

    # Token verified! User information is inside result dictionary
    claims = result
    user_email = claims.get("email", "unknown")
    user_id = claims.get("sub", "unknown")

    # Perform mock secondary cloud task (e.g. log auditing, meta classification)
    print(f"Verified AWS Cognito Token for User {user_email} (ID: {user_id})")

    response_body = {
        "status": "success",
        "message": "Authorized successfully by secondary cloud (GCP)!",
        "aws_cognito_claims": {
            "user_id": user_id,
            "email": user_email,
            "given_name": claims.get("given_name"),
            "family_name": claims.get("family_name")
        },
        "gcp_processed_at": "GCP Cloud Function (python-runtime)"
    }

    return (json.dumps(response_body), 200, headers)
