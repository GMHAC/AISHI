# RIZVI FOMS — Phase 5: KPI, Audit, NC/CAPA

## Actual implementation
- PostgreSQL migration: `database/005_kpi_audit_nc_capa.sql`
- KPI evaluation engine
- Audit finding validation
- Nonconformity register
- CAPA lifecycle state machine
- Root-cause, corrective and preventive action records
- Effectiveness-review closure gate
- Verification and audit trace structures
- Automated unit tests

## CAPA lifecycle
OPEN → INVESTIGATION → ACTION → IMPLEMENTED → EFFECTIVENESS_REVIEW → CLOSED

Effectiveness review can return the CAPA to ACTION.
Closure requires effectiveness evidence/result and a verifier.
