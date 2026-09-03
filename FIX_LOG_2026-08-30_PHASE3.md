# RIZVI FOMS — Phase 3 Audit & Fix Log (2026-08-30)

## Scope of this phase
Instruction section "27. AUDIT MANAGEMENT" — a Universal Audit Engine covering Internal, External,
Buyer, ISO, Social, Safety, Compliance, Environmental, Financial, IT, and Process audits, with the
workflow: Audit Plan → Checklist → Audit → Finding → NC → Root Cause → CAPA → Responsible Person →
Due Date → Evidence → Verification → Closure.

## Gap found
No table or route existed for a formal audit-plan/finding workflow. `routes/audit.js` is only the
system change-log viewer (who edited which database row), not a plannable audit with findings.

## Built in this pass
1. **`audit_plans` table** — audit_type (one of the 11 types above), title, department/section,
   scheduled_date, auditor, linked checklist_category, status (planned/in_progress/completed/cancelled).
2. **`audit_findings` table** — one or more findings per audit plan; each can be flagged `is_nc`.
3. **`backend/routes/audit-management.js`** — create/list/detail plans, transition plan status, record
   findings. **A finding marked as Non-Conformity automatically opens a record in the shared CAPA engine
   built in Phase 2** (`source_module='audit'`, linked back via `audit_findings.capa_id`) — root cause,
   corrective/preventive action, evidence, verification, and closure all happen through the one CAPA
   engine, so audit NCs and checklist NCs never fall out of sync with each other.
4. Dashboard endpoint: audits by type/status, open NC findings still unresolved in CAPA, overdue plans.
5. Mounted at `/api/audit-management` in `server.js`.

## Verification performed
- `node --check` clean on all changed/new files.
- Full schema + every query in the new route (including the 3-table join in the dashboard endpoint)
  executed against real SQLite with sample data — all returned correct results.
- Still cannot run a live `npm install`/server boot in this sandbox (no network access) — needs to be
  run once on a networked machine before go-live, same note as Phases 1 and 2.

## Running total of what's been rebuilt so far (Phases 1–3)
- Fixed 10.6MB of duplicated embedded images (package 36MB → 13MB).
- Added the CAPA / Continual Improvement engine (shared across every module, as the instruction
  requires) with full lifecycle and dashboard.
- Added the Risk Register with auto-scored, department-wise risk dashboard.
- Extended the checklist engine with category/frequency/NC-critical flags and automatic NC→CAPA
  escalation, plus a Pending/Completed/Overdue/Non-Conformity status endpoint.
- Added the Universal Audit Engine (11 audit types) with Finding→NC→CAPA auto-linkage.

## Still not done — honest remaining scope
1. **Frontend wiring** — none of the Phase 1–3 backend APIs (CAPA, Risk, Audit Management, checklist
   status) are called from `index.html` yet. The engines exist and are verified at the database/API
   level, but there's no dashboard screen showing them yet.
2. **Marketing & Merchandising** buyer-to-shipment pipeline (instruction section 13) — not yet checked.
3. **HRM, Attendance/Payroll, Production/IE, Procurement, Inventory, ISO/IMS module-by-module pass** —
   not yet checked against the instruction, department by department.
4. **Master Dashboard role-based views** (MD / GM Production / GM HR / Department Head / Employee) —
   instruction section 31 — not yet checked.
5. A real `npm install` + boot test on a machine with internet access.

Continuing in the same order next.
