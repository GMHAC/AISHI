# RIZVI FOMS — Phase 10: Production Deployment Package

## Package contents
- Docker deployment baseline
- PostgreSQL production service topology
- Nginx reverse proxy configuration
- Health checks
- Environment template
- OIDC production preflight
- Systemd deployment alternative
- Backup script
- Migration order
- Production go-live checklist

## Suggested release process
1. Copy `.env.production.example` to a protected deployment secret source.
2. Set real PostgreSQL and approved OIDC values.
3. Run `deploy/scripts/preflight.sh`.
4. Validate migrations on staging.
5. Run `python -m pytest tests --strict-markers`.
6. Build the container image.
7. Start production services.
8. Verify `/health`.
9. Verify authenticated RBAC flows.
10. Verify backup and restore procedures.

No production secrets, certificates, fake OIDC credentials or fabricated live-service claims are included.
