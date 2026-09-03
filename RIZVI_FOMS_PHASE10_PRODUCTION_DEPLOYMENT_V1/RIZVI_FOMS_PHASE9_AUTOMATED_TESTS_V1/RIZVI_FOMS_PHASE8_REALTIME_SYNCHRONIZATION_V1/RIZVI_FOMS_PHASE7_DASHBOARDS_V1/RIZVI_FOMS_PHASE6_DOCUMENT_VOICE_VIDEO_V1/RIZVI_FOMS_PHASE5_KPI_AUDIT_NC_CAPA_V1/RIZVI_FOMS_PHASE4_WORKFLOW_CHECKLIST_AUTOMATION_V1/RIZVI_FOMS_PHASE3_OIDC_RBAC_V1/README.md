# RIZVI FOMS — Phase 3 OAuth/OIDC + RBAC

This package adds Phase 3 implementation artifacts to the earlier Phase 1/2 work.

Run the PostgreSQL migration:
`database/003_oidc_rbac.sql`

Configure the approved identity provider with:
`OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL`.

No hard-coded business passwords are used for OIDC authentication.
