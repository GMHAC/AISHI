# RIZVI FOMS — Phase 7 Audit & Fix Log (2026-08-30)

## Scope: Production Management + IE & Performance + Planning Management
Instruction sections 9, 10, 11 — the factory's core operational engine.

## Built in this pass (`backend/routes/production.js`, 5 new tables in `db.js`)
1. **Production Lines** — line/department/section, rated capacity (pcs/hour), manpower count.
2. **SMV/SAM records** — style + operation → Standard Minute Value → auto-computed target
   pcs/hour (60/SMV), covering the Operation Bulletin/Time Study part of IE.
3. **Production Orders** — Style/Buyer/PO/Order Quantity/Line, status
   planning→in_production→completed→shipped/cancelled.
4. **Production Plans** — the full instruction chain in one table:
   Plan (planned_qty) → Actual (actual_qty) → **auto-computed Achievement %** → Failure Reason →
   Recovery Plan → Revised Target, one row per plan_type/date so Annual/Monthly/Weekly/Daily/Hourly
   cycles all use the same structure.
5. **Daily/Hourly Production Reports** — Target vs Achieved (**auto-computed Efficiency %**), DHU,
   Rejection, Alter, Rework, WIP, manpower present, per line per date/hour.
6. **Dashboard** — efficiency/DHU/rejection aggregated by line and by department (Line Performance /
   Department Performance from instruction section 10), plus a live list of plans that closed below
   90% achievement (the actionable output of the Failure→Reason chain).

## A subtle bug caught before packaging
The dashboard's by-line query originally built its WHERE clause with a `.replace(/^/, 'dpr.')`
string trick to add table prefixes conditionally — fragile and easy to get wrong (parameter order
could silently mismatch the placeholders). Rewrote it as two explicit, separately-built filter
arrays (one for the by-line query with the department condition, one for by-department without it)
so the SQL text and the parameter array are always constructed together and can't drift apart. This
was caught by re-reading the code before validation, then confirmed correct by actually running it.

## Verification performed
- `node --check` clean.
- Ran a script that counts every `db.exec(\`` open against every closing `` `); `` in `db.js` — 48
  and 48, confirming no more unclosed template literals anywhere in the file (the Phase 6 bug was
  exactly this kind of mismatch, so this check is now part of the routine).
- Full realistic flow validated against real SQLite: create line → create order → add SMV → create
  a daily plan → close it with a shortfall (achievement 84%, failure reason, recovery plan, revised
  target) → log a daily production report (efficiency 84%, DHU 2.1, rejection 8) → run both
  dashboard aggregation queries (by-line, by-department) and the below-90%-achievement query — all
  returned correct results.
- No live server boot possible in this sandbox (no network) — same standing note as every phase.

## Running total (Phases 1–7)
Image bug fix · CAPA engine · Risk Register · Checklist NC engine · Universal Audit Engine ·
Section/Department Admin roles · passwordless Employee login · Video Conferences · Circular
broadcast · Buyer Complaint→CAPA · full HRM lifecycle · Production/IE/Planning engine.

## Still not done
1. Frontend wiring — still the largest remaining item, nothing from Phases 1–7 is in `index.html` yet.
2. Procurement, Inventory, ISO/IMS, Fabric, Traceability — still on the generic `enterprise_events`
   layer.
3. Master Dashboard role-based views.
4. Live `npm install` + boot test on a networked machine, and running the seed scripts.

Continuing to Procurement + Inventory next.
