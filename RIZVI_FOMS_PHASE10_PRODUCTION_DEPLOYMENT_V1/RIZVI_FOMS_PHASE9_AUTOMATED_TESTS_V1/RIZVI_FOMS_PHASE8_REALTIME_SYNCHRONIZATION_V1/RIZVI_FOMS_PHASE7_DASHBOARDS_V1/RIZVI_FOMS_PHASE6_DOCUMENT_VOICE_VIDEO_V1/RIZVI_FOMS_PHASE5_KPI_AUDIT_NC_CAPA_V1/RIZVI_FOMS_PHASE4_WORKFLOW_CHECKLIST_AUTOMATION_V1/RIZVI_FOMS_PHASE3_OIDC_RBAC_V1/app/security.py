import os, jwt
from fastapi import HTTPException, Request
from jwt import PyJWKClient
ISSUER=os.getenv("OIDC_ISSUER","")
AUDIENCE=os.getenv("OIDC_AUDIENCE","")
JWKS_URL=os.getenv("OIDC_JWKS_URL","")
def verify_oidc_bearer(request:Request):
    auth=request.headers.get("Authorization","")
    if not auth.startswith("Bearer "): raise HTTPException(401,"Bearer token required")
    if not (ISSUER and AUDIENCE and JWKS_URL): raise HTTPException(503,"OIDC not configured")
    try:
        key=PyJWKClient(JWKS_URL).get_signing_key_from_jwt(auth[7:]).key
        return jwt.decode(auth[7:],key,algorithms=["RS256","ES256"],audience=AUDIENCE,issuer=ISSUER)
    except Exception: raise HTTPException(401,"Invalid or unverified OIDC token")
