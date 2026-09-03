# RIZVI FOMS — Phase 2 Audit & Fix Log (2026-08-30)

## Scope of this phase
Checked the checklist engine, CAPA/continual-improvement engine, risk management, and KPI engine
against the instruction PDF sections:
- "SMART CHECKLIST CENTER" (Daily/Weekly/Monthly/Periodic/ISO/Buyer/Legal-Regulatory/Internal/
  Department/Employee-Responsibility checklist tabs; Pending/Completed/Overdue/Non-Conformity states)
- "28. RISK MANAGEMENT" (Risk → Probability → Impact → Risk Score → Control → Responsible → Action → Review)
- "29. KPI / PERFORMANCE ENGINE"
- "30. CAPA / CONTINUAL IMPROVEMENT ENGINE" (Problem → Incident → NC → Root Cause → Corrective Action
  → Preventive Action → Responsible Person → Deadline → Evidence → Verification → Closure — one shared
  engine reused across Quality, Compliance, Safety, HR, IT, Audit)
- Audit workflow (Audit Plan → Checklist → Audit → Finding → NC → Root Cause → CAPA → Responsible →
  Due Date → Evidence → Verification → Closure)

## What was verified as already correct (no change needed)
The KPI engine (`backend/lib/kpi.js`, `backend/routes/kpi.js`) is solid and matches the spec closely:
Daily/Weekly/Monthly/Quarterly are calendar-based, Half-Yearly/Annual are anchored to each employee's
join date exactly as the instruction describes, with completion-coverage reporting alongside the score.

## Real gap found: CAPA engine and Risk Register did not exist
The database had **no table at all** for CAPA, non-conformity, or risk data. `audit_logs` only stores
generic "who changed which database row" system events — it is not the ISO Finding → NC → Root Cause →
CAPA → Verification → Closure workflow the instruction describes. Checklist responses were a flat
yes/no/partial with no category (ISO/Buyer/Legal/Internal/etc.), no frequency, and no link to any
consequence when an answer was "no."

### Built in this pass
1. **`capa_records` table + `backend/routes/capa.js`** — full lifecycle: create (Problem/Incident/NC) →
   root cause/corrective/preventive action → evidence submission → admin verification → close. Severity
   (minor/major/critical), `source_module` shared across quality/compliance/safety/hr/it/audit/checklist/
   buyer/production so one engine serves every module as the instruction requires. Dashboard endpoint
   (open count, overdue, by severity, by module).
2. **`risk_register` table + `backend/routes/risk.js`** — Risk/Probability/Impact/auto-computed Risk
   Score/Control/Responsible/Action/Review, per department, with a dashboard (heat-map by department,
   critical risks ≥15, risks due for review in the next 7 days).
3. **`checklist_items` extended** with `category` (iso/buyer/legal_regulatory/internal/department/
   employee_responsibility), `frequency` (daily/weekly/.../periodic), `section`, and `is_nc_critical`.
4. **Automatic NC → CAPA linkage**: when an `is_nc_critical` checklist item is answered "no," the system
   now automatically opens a draft CAPA record (source_type `checklist_nc`) instead of just recording a
   failed checklist row with no follow-up — this was the concrete missing link between the checklist
   engine and the CAPA engine that the instruction implies but the old code did not implement.
5. **New `GET /api/checklist/status/:employeeId/:date`** — returns the exact four states the instruction
   names: Pending / Completed / Overdue / Non-Conformity, per checklist item.
6. Both new route files mounted in `server.js` (`/api/capa`, `/api/risk`).

## Verification performed
- `node --check` on every changed/new file: clean.
- All new/changed SQL (table DDL, indexes, and every query used in the new routes) executed against a
  real SQLite engine (Python's built-in `sqlite3`, same SQL dialect as `better-sqlite3`) with sample data
  — schema creation, inserts, the severity-ordered CAPA list query, the overdue query, the verify/close
  update, and the risk dashboard grouping query all ran and returned correct results.
- Could not run the actual Node/Express server end-to-end: this sandbox has no network access, so
  `npm install` cannot reach the npm registry (confirmed with a 403 on an isolated test folder, not just
  this project). This needs to be run once on a machine with internet access before relying on it.

## Still not done — real remaining scope
This phase closed one specific, well-defined gap (CAPA/Risk engine). Still outstanding, in priority order:
1. **Wire the CAPA/Risk/Checklist-status APIs into the frontend UI** (`index.html`) — the backend now
   supports them; the dashboard pages don't yet call them.
2. **Audit workflow module** — a dedicated `Audit Plan → Checklist → Audit → Finding` flow that creates
   CAPA records from formal audits (internal/external/buyer), not just from daily checklists.
3. **Marketing & Merchandising** buyer-to-shipment pipeline (Section 13 of the instruction) — not yet
   checked against code.
4. **HRM, Attendance/Payroll, Production/IE, Procurement, Inventory, ISO/IMS module-by-module pass** —
   not yet checked against code.
5. Real `npm install` + boot test once run on a networked machine.

Will continue with the next phase in the same priority order.
