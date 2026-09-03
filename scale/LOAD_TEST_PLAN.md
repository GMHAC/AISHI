# RIZVI FOMS Load Test Plan

Run only against a staging project with synthetic data.

Scenarios:
1. Login burst: 1,000 → 2,500 → 5,000 → 10,000 virtual users.
2. Dashboard reads: 100/300/600 requests per second.
3. Document initiate: 50/100/250 requests per second.
4. Direct object upload: 1,000 / 10,000 / 100,000 objects in controlled batches.
5. Pub/Sub processing backlog recovery.
6. Attendance punch burst at shift start/end.
7. Salary import with large XLSX/CSV.
8. Failure injection: API restart, worker restart, temporary Storage errors, database failover.

Acceptance examples:
- No data loss.
- No duplicate document records after retry.
- Upload retry resumes rather than restarting unnecessarily.
- API p95/p99 targets are defined by management and measured.
- Queue backlog drains within the agreed SLA.
- Database CPU/connection limits remain below agreed thresholds.
- Audit trail exists for all administrative state changes.
