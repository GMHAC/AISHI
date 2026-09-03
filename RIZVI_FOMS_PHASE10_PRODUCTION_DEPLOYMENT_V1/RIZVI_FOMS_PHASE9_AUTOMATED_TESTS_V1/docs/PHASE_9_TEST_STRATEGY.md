# Phase 9 — Automated Test Strategy

## Test layers
1. Unit tests
   - Workflow frequency rules
   - Checklist/evidence gates
   - KPI evaluation
   - CAPA transitions
   - Audit classification
   - Media classification
   - Real-time idempotency

2. Security tests
   - Missing permission denial

3. Contract tests
   - Real-time event envelope structure

## Production test gates
Recommended CI gates:
- install dependencies
- static/lint checks
- unit tests
- database migration validation against disposable PostgreSQL
- integration tests
- API authorization tests
- event publish/consume tests
- security scanning
- build artifact only when required gates pass

This package contains executable tests for the currently implemented application
modules. Full end-to-end tests require a deployed application and real configured
OIDC, PostgreSQL, object storage and event infrastructure.
