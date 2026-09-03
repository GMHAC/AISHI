#!/usr/bin/env sh
set -eu
: "${OIDC_ISSUER:?OIDC_ISSUER required}"
: "${OIDC_AUDIENCE:?OIDC_AUDIENCE required}"
: "${OIDC_JWKS_URL:?OIDC_JWKS_URL required}"
: "${POSTGRES_DB:?POSTGRES_DB required}"
: "${POSTGRES_USER:?POSTGRES_USER required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}"
echo "Production preflight: required configuration present."
