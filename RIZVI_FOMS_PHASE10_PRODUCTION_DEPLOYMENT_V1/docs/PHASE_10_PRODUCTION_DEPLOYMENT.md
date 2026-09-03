# Phase 10 — Production Deployment Package

## Included
- Dockerfile
- Docker Compose production topology
- PostgreSQL 16 service definition
- Reverse-proxy configuration
- Application health-check
- Production environment template
- OIDC configuration preflight
- Systemd service alternative
- PostgreSQL backup script
- Migration-order guide

## Deployment topology
Internet / corporate network
→ TLS reverse proxy
→ application service
→ PostgreSQL

External production services remain configurable:
- Approved OIDC identity provider
- TLS certificate management
- Object storage
- Antivirus/media processing services
- Durable event broker and workers
- Monitoring and alerting

## Required production controls
1. Replace all CHANGE_ME values using a secret manager.
2. Use HTTPS/TLS certificates managed by the deployment environment.
3. Run migrations in staging first.
4. Run automated tests before release.
5. Restrict database network exposure.
6. Configure backups and restore testing.
7. Configure monitoring and alerting.
8. Configure OIDC issuer/audience/JWKS from the approved identity provider.
9. Do not commit production secrets into source control.

## Important
This package is a deployable infrastructure baseline, not a claim that an
unconfigured archive is already running as a live production service.
Production go-live requires environment-specific secrets, DNS, certificates,
infrastructure provisioning, migration execution and operational verification.
