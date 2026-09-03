# Phase 3 — OAuth/OIDC + RBAC

Required OIDC configuration:
- OIDC_ISSUER
- OIDC_AUDIENCE
- OIDC_JWKS_URL

Flow:
1. User authenticates with an approved OpenID Connect provider.
2. Client receives a signed access token.
3. API receives `Authorization: Bearer <token>`.
4. Server verifies the token signature through JWKS, issuer and audience.
5. OIDC `sub` maps to the employee record.
6. Server loads employee roles and permissions from PostgreSQL.
7. Protected actions are authorized server-side.

Production provider credentials are not fabricated or embedded in source code.
