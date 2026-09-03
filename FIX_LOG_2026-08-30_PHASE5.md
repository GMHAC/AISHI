# RIZVI FOMS — Phase 5 Audit & Fix Log (2026-08-30)

## Important architecture finding
Checked how Marketing & Merchandising, Fabric, Procurement, Inventory, Traceability, Production,
ISO/IMS, Live Tracking, Payroll, and HR are implemented. **They all share one generic table**
(`enterprise_events`: module + event_type + department/section/designation + free-form JSON
payload), via `routes/enterprise.js`, instead of each having its own dedicated schema like
attendance/salary/complaints/checklist do.

This is a real, working mechanism — not a placeholder — but it means those 10 modules are
**structurally thinner** than the ones with dedicated tables: no per-module field validation, no
relational integrity between (say) an Order and its Shipment, everything is a JSON blob per event.
It was already functional before this phase; this phase made two concrete improvements to it.

## Built in this phase
1. **Buyer Feedback → Complaint → CAPA auto-linkage** (instruction section 13's Marketing &
   Merchandising pipeline ends with exactly this chain). A marketing-module event with
   `event_type: "complaint"` now automatically opens a record in the Phase-2 CAPA engine
   (`source_module: 'buyer'`), same pattern as checklist NCs (Phase 2) and audit findings (Phase 3)
   — one CAPA engine, three different sources feeding it.
2. **Marketing event_type whitelist** — `POST /api/enterprise/events` now validates marketing-module
   events against the instruction's actual pipeline stages (communication, inquiry, costing,
   style_development, tech_pack, sample, order, t_and_a, delay_management, production_follow_up,
   shipment, buyer_feedback, complaint, buyer_rating) instead of accepting any arbitrary string.
3. **Scope enforcement extended to this endpoint** — department_admin/section_admin can now log
   events for their own department/section (previously admin/director only), consistent with
   Phase 4's "hourly task update" requirement, and consistent with the scope-checking pattern used
   in `checklist.js`.
4. Fixed a copy-paste duplication bug introduced while editing this file in this same phase (an
   old, unreachable duplicate `INSERT INTO enterprise_events` block was left behind after the
   edit) — caught before packaging by re-viewing the file and confirming no duplicate routes exist.

## Verification performed
- `node --check` clean.
- Confirmed via `grep` that `/events` (POST) is registered exactly once — no duplicate/shadowed route.
- The event-insert + CAPA-auto-open transaction validated against real SQLite with sample buyer
  complaint data — correct result.

## Honest assessment — what "everything" actually means from here
You asked for everything to be done, one by one. Being straight with you about size: the remaining
9 modules on the generic-events layer (Fabric, Procurement, Inventory, Traceability, Production,
ISO/IMS, Live Tracking, Payroll-specific screens, full HRM) are each described in the instruction in
similar depth to Marketing & Merchandising — multiple pages, multiple sub-workflows, buyer/vendor/
machine-specific fields. Giving each of them the same dedicated-table treatment CAPA/Risk/Audit got
in Phases 2–3 is realistically **one focused phase per module**, the same size of work as this one,
not something to compress into a single pass without it becoming shallow again.

Attendance and Payroll already have real dedicated tables and a working KPI engine (checked in
Phase 2) — those don't need the same rebuild, mainly a module-by-module feature checklist against
the instruction.

Proposing to continue in this order next: **HRM** (largest single block of the instruction —
recruitment, training records already exist, competency/skills assessment, succession planning),
then **Production/IE** (capacity planning, line efficiency — ties into the KPI engine already
built), then Procurement/Inventory together (they share a vendor/stock relationship), then ISO/IMS
document control, then a final frontend-wiring pass over everything built in Phases 1–5.
