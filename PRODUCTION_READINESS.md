# RIZVI FOMS — Production Readiness & Go-Live Gate

## Source of truth
The attached `Software instruction.pdf` remains the functional source-of-truth for the supplied requirements. This build preserves the documented 18 Corporate / 91 Department / 156 Section / 564 Designation master coverage and the Daily→Weekly→Monthly→Quarterly→Half-Yearly→Annual evaluation cycle.

## What is implemented
- Enterprise master-data registry
- Role-based backend authentication
- Employee master import (CSV/XLSX)
- Attendance, GPS punch fields, weekly-hour signal
- Salary import and attendance-vs-salary OT reconciliation
- Checklist + evidence/note flow
- KPI, training, complaint and policy APIs
- Operational task/sync snapshot API
- Audit log database and protected audit API
- Database readiness/health endpoints
- SQLite WAL mode and native backup script
- Firebase Hosting/Firestore configuration
- PWA frontend package

## Roles
The source specification describes Super Admin/Owner, Management, Sub-Admin, Department-Admin and User/Employee concepts. The current backend supports the core `admin`, `director`, and `employee` roles. Before go-live, map the organization's exact approval matrix to these or extend RBAC; do not expose administrative privileges by convention.

## Required real-world go-live gates
1. Replace all example secrets/passwords.
2. Configure the real Firebase project and approved domains.
3. Run the backend behind HTTPS and a reverse proxy/load balancer.
4. Use managed persistent storage/backup for the operational database; SQLite is suitable for a controlled single-node deployment, not an automatic multi-node HA database.
5. Connect and test the actual biometric/access-control machines; GPS phone punch is not a substitute for machine integration.
6. Validate payroll/OT rules against approved company policy and legal requirements.
7. Import a clean employee master and verify all 564 designation records against the organization's approved mapping.
8. Configure backup retention and perform a restore drill.
9. Perform security review, permission/UAT testing and load testing with the expected employee count.
10. Sign off the production acceptance checklist before using payroll or disciplinary outputs as official records.

## Backup
From `backend/`:
`npm run backup`

## Start
From `backend/`:
`npm install`
`npm run seed-admin`
`npm start`

## Health
- `/api/health`
- `/api/ready`

## Important honesty boundary
This package is a production-oriented implementation and deployment base. It does not claim that an unconnected software package is already integrated with unknown physical biometric devices, telecom/GSM location infrastructure, payroll banks, WhatsApp Business, or every external corporate system. Those integrations require their actual credentials, APIs/devices, contracts and test environments.
