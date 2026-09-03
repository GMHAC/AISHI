# Production Go / No-Go — RIZVI FOMS

## GO only when all are true
- [ ] Production transactional database migrated from SQLite to managed PostgreSQL/Cloud SQL.
- [ ] Documents use Cloud Storage direct/resumable upload; no production dependency on local `/uploads`.
- [ ] Pub/Sub worker + dead-letter/retry flow is deployed.
- [ ] Firebase/enterprise authentication is enabled and RBAC is tested.
- [ ] 10,000-user load test passes in staging.
- [ ] Shift-start attendance burst test passes.
- [ ] Large import test passes for CSV/XLSX/Word/PDF workflows.
- [ ] Malware scanning/OCR pipeline is active where required.
- [ ] Backup + point-in-time recovery + disaster recovery restore test passes.
- [ ] Monitoring, alerting and audit logs are operational.
- [ ] Management UAT signs off.

## NO-GO conditions
- SQLite is the shared production database.
- Files are stored only on a Cloud Run/local container filesystem.
- API receives every large file byte before storing it.
- Secrets are committed into frontend source.
- No load test has been performed.
- No restore test has been performed.
