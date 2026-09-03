# Actual Phase 3 Status
Implemented in this package:
- OAuth/OIDC configuration contract
- JWKS-based signed-token verification code
- Issuer and audience validation
- OIDC subject identity concept
- PostgreSQL role table
- PostgreSQL permission table
- Employee-to-role mapping
- Role-to-permission mapping
- Main Admin, Management, Department Admin, Section Admin and Employee role seed
- Server-side authorization helper

A real production OIDC provider cannot be truthfully bundled without its approved issuer/client/audience/JWKS configuration and deployment environment.
