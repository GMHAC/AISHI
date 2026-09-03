# RIZVI FOMS — Phase 6 Audit & Fix Log (2026-08-30)

## Scope: HRM — Full Employee Lifecycle Management
Instruction section 4: Manpower Requisition → Recruitment → Interview → Selection → Joining →
Employee Master → Probation → Confirmation → Transfer → Promotion → Increment → Training →
Performance → Disciplinary → Separation → Final Settlement → Alumni.

Employee Master, Training records, and Performance/KPI already existed (checked, working, no
change needed). Everything else in that lifecycle had no table at all — built in this phase.

## Built in this pass (`backend/routes/hrm.js`, 4 new tables in `db.js`)
1. **Manpower Requisition** — department requests a designation/headcount, status
   pending→approved/rejected→fulfilled, with an approval trail.
2. **Recruitment** — CV database + Interview Management + Selection, one `stage` field walking
   through cv_received → shortlisted → interview_scheduled → interviewed → selected →
   offer_sent → joined/rejected/withdrawn, linked back to the requisition it's filling.
3. **Employment history** (Probation/Confirmation/Transfer/Promotion/Demotion/Increment/
   Department·Section·Designation change) — one append-only log per employee, and promotion/
   transfer/department/section/designation/increment changes **automatically sync the employee
   master record** (e.g. a promotion event updates `employees.designation`), so the history log
   and the live employee record never disagree with each other.
4. **Separation** — resignation/termination/contract-end/retirement, exit interview notes, final
   settlement amount/status, service/experience certificate flags. **Marking final settlement
   "paid" automatically moves the employee to `status = 'Terminated'`**, which is what the Alumni
   list (`GET /api/hrm/alumni`) filters on — completing Employee Lifecycle → Separation → Final
   Settlement → Alumni as one connected flow, not three disconnected screens.
5. Dashboard: open requisitions, active recruitment pipeline size, pending final settlements,
   candidates by stage.

## A real bug caught and fixed before packaging
While adding the HRM tables to `db.js`, the `db.exec(\`...\`)` template-literal block was left
**unclosed** (missing closing backtick + `);`) — `node --check db.js` failed immediately with
`SyntaxError: Unexpected end of input`. Found the unclosed block with `grep`, closed it, reran
`node --check` on every changed file until all were clean. This is exactly why every phase in this
project runs a syntax check before packaging — this kind of typo is easy to make and easy to miss
by eye in a large file.

## Verification performed
- `node --check` clean on all 12 backend files touched across every phase so far (re-verified
  together this time, not just the newest files).
- Full HRM schema + a realistic end-to-end flow (create requisition → approve → add candidate →
  move through interview stage → promote the employee, confirming the master record updates →
  resign the employee → mark final settlement paid, confirming they appear in the Alumni query)
  executed against real SQLite — every step returned the correct result.
- Still no live `npm install`/server boot possible in this sandbox (no network) — same standing
  note as every previous phase; needs to run once on a networked machine.

## Running total (Phases 1–6)
Fixed 10.6MB of duplicated images · CAPA engine · Risk Register · Checklist NC engine · Universal
Audit Engine · Section/Department Admin scoped roles · passwordless Employee login · Video
Conference scheduling · Management Communication/Circular broadcast · Buyer Complaint→CAPA link ·
full HRM lifecycle (Requisition→Recruitment→History→Separation→Alumni).

## Still not done
1. Frontend wiring for everything built in Phases 1–6 — still the single biggest remaining item.
2. Production/IE, Procurement, Inventory, ISO/IMS, Fabric, Traceability — still on the generic
   `enterprise_events` layer, not yet given dedicated schemas.
3. Master Dashboard role-based views.
4. Live `npm install` + boot test + running the seed scripts on a real machine.

Continuing to Production/IE next, as planned.
