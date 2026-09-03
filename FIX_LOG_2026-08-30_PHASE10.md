# RIZVI FOMS — Phase 10 Audit & Fix Log (2026-08-30)

## Scope: Frontend wiring for Phases 2, 3, 6, 7, 8, 9
Nine sidebar modules that previously fell through to the generic placeholder page
(`genericModule()` — static mock progress bars, no real data) now render live data from the
backend APIs built in Phases 2–9:

| Sidebar module | Page code | Backend API |
|---|---|---|
| CAPA & Continual Improvement | m15 | `/api/capa` |
| Risk Management | m14 | `/api/risk` |
| Internal Audit Management | m12 | `/api/audit-management/plans` |
| External / Buyer Audit Management | m13 | `/api/audit-management/plans` (filtered to external/buyer/social/safety/environmental/security types) |
| Integrated ISO Management System | m11 | `/api/iso-management/clauses` + standards |
| HRM – Full HR Management | m04 | `/api/hrm/requisitions` |
| Production Management | m25 | `/api/production/orders` |
| Procurement Management | m29 | `/api/procurement/requisitions` |
| Inventory & Store Management | m30 | `/api/inventory/items` |

## How it works
A single config-driven engine (`LIVE_MODULES` + `liveModulePage()` / `liveModuleLoad()` /
`liveModuleBind()`) was added to `index.html`, following the existing codebase's own patterns
(`api()` helper, `esc()` escaping, `metric()` cards, `toast()` notifications) rather than
introducing a new style. Each module entry declares its title, list/dashboard endpoints, table
columns, and a create-form field list; the engine renders a create form + live table + dashboard
metrics for all nine from that one shared implementation, instead of nine separate hand-written
page functions. `render()`'s routing was extended with one line to send these page codes to the new
engine, and falls through to `genericModule()` for everything else exactly as before.

## Verification performed (three separate checks, since this is the highest-risk phase)
1. **Syntax**: extracted both inline `<script>` blocks from `index.html` and ran `node --check` on
   each — clean. Also reconfirmed the entire backend (`routes/`, `middleware/`, `lib/`, `scripts/`,
   `db.js`, `server.js`) still passes a full syntax sweep after this phase's edits.
2. **Simulated render test (online)**: built a Node test harness that mocks `document`/`$`/`toast`/
   `api()` and feeds each of the 9 modules a response shaped exactly like what its real backend
   route returns (verified in Phases 2–9's own SQL testing). Ran `liveModulePage()` →
   `liveModuleLoad()` → `liveModuleBind()` for all 9 and asserted: the page HTML contains the
   module's title, the rendered table has no `undefined` values (a common silent bug when a column
   key doesn't match the API's actual field name), and the status indicator flips to "API
   CONNECTED." All 9 passed.
3. **Simulated render test (offline)**: reran the same harness with `api()` always returning `null`
   (API not configured — the state a fresh deployment starts in) and asserted the status correctly
   shows "API OFFLINE" with a clear Bengali message instead of a blank page or a thrown error. All
   9 passed.
4. Synced the fixed `index.html` to `backend/public/index.html` (kept identical, per the Phase 1
   fix) and re-ran the full syntax sweep on both copies plus the whole backend one more time as a
   final check before packaging.

## Honest scope of what this phase does and doesn't cover
- **Read + Create** work for all 9 modules (list existing records, submit a new one). Status
  transitions, approvals, the CAPA lifecycle actions (root cause/evidence/verify), PO receiving,
  document publishing, etc. — all the deeper workflow actions from Phases 2–9 — are not yet wired
  to buttons in the UI; they exist and are verified at the API level, but need their own forms.
- Conferences (Phase 4), Circulars (Phase 4), Section/Department Admin role management (Phase 4),
  and Employee Lifecycle history/separation (Phase 6, beyond the requisition list) are not yet
  wired into the frontend at all.
- Document Control (Phase 9's `controlled_documents`) is separate from the existing `m21` document
  upload page, which was left untouched since it already works — merging them is future work.
- Still cannot verify this actually renders correctly in a real browser (no network in this sandbox
  to load a browser or the backend together) — the simulated test proves the JavaScript logic is
  correct against realistic data, not that the visual layout looks right end-to-end.

## Running total (Phases 1–10)
Backend: image fix, CAPA, Risk, Checklist NC, Audit, Roles, Conferences, Circulars, Buyer
Complaint→CAPA, HRM, Production/IE/Planning, Procurement↔Inventory, ISO/Document Control.
Frontend: 9 previously-placeholder sidebar modules now show live backend data with working create
forms.

## Still not done
1. Deeper workflow actions (status transitions, approvals, receiving, verification) in the UI.
2. Conferences, Circulars, Role management, Employee history/separation screens.
3. Fabric-specific inspection, Traceability, remainder of Marketing & Merchandising pipeline.
4. Master Dashboard role-based views.
5. A real `npm install` + server boot + browser test on a machine with internet access — the true
   final check that everything built across all 10 phases actually works together live.
