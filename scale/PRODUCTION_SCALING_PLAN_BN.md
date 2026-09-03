# Production Scaling Plan — RIZVI FOMS

## Tier 1 — Local development
SQLite + local files are acceptable only for development/demo.

## Tier 2 — Pilot
Cloud Run + Cloud Storage + Pub/Sub + Firebase Authentication + managed PostgreSQL.

## Tier 3 — Enterprise
- Cloud Run API, min 3 warm instances, autoscale according to load
- Cloud SQL PostgreSQL HA for transactional HR/attendance/payroll data
- Cloud Storage for all documents
- Pub/Sub for ingestion/event fan-out
- separate workers for OCR, virus scanning, previews and imports
- CDN/cache for static frontend
- centralized logs/metrics/alerts
- automated database backup + PITR
- multi-zone HA and tested disaster recovery

## Capacity target
Design target: 10,000 active users and millions of uploaded objects/day. Capacity must be proven by load tests in the selected GCP region before production sign-off.

## Non-negotiable
A “10,000-user” claim is not a substitute for load testing. Run staged tests at 1k → 2.5k → 5k → 10k users and burst upload tests before management go-live.
