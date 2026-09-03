# Production Readiness Gate

This package is a combined Phase 1–10 delivery archive. A live production release
still requires environment-dependent controls:

- Approved exact Department → Section → Designation mapping import where absent.
- PostgreSQL migration verification.
- Approved OAuth/OIDC provider configuration.
- TLS/DNS and secret-manager configuration.
- Object storage and malware/media processing activation.
- Durable event worker and retry/dead-letter deployment.
- Automated test execution.
- Load/performance testing.
- Security assessment and remediation.
- Backup/restore and DR drill.
- UAT and management sign-off.

Do not represent the archive alone as a verified live deployment before these gates pass.
