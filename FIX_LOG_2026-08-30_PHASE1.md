# RIZVI FOMS — Phase 1 Audit & Fix Log (2026-08-30)

## Source used
`SOURCE_Software_instruction_UPDATED_2026-08-30.pdf` (uploaded as `45_Depart-Soft.pdf`) — unlike the
previously packaged `SOURCE_Software_instruction.pdf`, this file has a real, extractable text layer
(96 pages, ~4,400 lines). It has been added to the package and is now the readable source of truth.
The old scanned copy was removed to avoid two conflicting "source" files.

## What was verified as correct (no change needed)
- Master data counts match the instruction exactly: Corporate 18, Department 91, Section 156,
  Designation 564.
- All backend `.js` files pass `node --check` (no syntax errors).
- All JSON config files parse correctly.
- `backend/server.js` correctly mounts every route file that exists in `backend/routes/` — no
  orphaned or missing route wiring.
- `firestore.rules` and `firebase.json` are syntactically valid and internally consistent
  (API rewrite → Cloud Run service, hosting → Firestore).
- The frontend `index.html` is not just a static shell — it has real page functions
  (`corporatePage`, `departmentPage`, `sectionPage`, `designationPage`, `attendancePage`,
  `payrollPage`, `checklistPage`, `genericModule`, `idResponsibilityPage`, `taskPage`, etc.) driven
  from the master-data JSON.

## Bug found and fixed in this pass
**Same 1,536×1,536 decorative PNG was embedded as base64 text 3 times inside `index.html`, and
again 3 times inside `backend/public/index.html` — 6 copies of one image, ~1.77MB of base64 text
each, ~10.6MB of pure waste.** This alone was responsible for almost the entire 5.3MB size of each
`index.html` file.

Fix: extracted the image once to `assets_rose.png` (and a synced copy in `backend/public/`), and
replaced all 6 inline base64 copies with a normal `<img src="assets_rose.png">` / JS reference.

**Result: package size 36MB → 13MB. `index.html` 5.36MB → 68KB. `backend/public/index.html` 5.36MB → 61KB.**
No visual or functional change — same image, loaded once instead of embedded six times.

## Not yet done (honest status — this is a large ERP, not a one-pass fix)
The instruction PDF describes, in detail, per-module requirements for every one of the 45 main
sidebar modules (checklist engine, KPI, ISO clause mapping, CAPA workflow states, evidence/document
flow, real-time sync) across 91 Departments / 156 Sections / 564 Designations. Verifying and, where
missing, building each of those module-by-module against the PDF is the remaining work. It has not
been done in this pass — doing it honestly (not just claiming "PASS") requires going through each
module individually.

### Proposed next phases
1. **Data-layer completeness** — confirm every Department/Section/Designation record actually
   carries the fields the PDF requires (Purpose, KPI, responsibility, checklist links, ISO mapping),
   not just the name.
2. **Checklist / CAPA engine** — verify the Finding → NC → Severity → Responsible → CAPA → Target →
   Notification → Verification → Closure lifecycle described in the PDF is implemented, not just
   scaffolded.
3. **Module-by-module UI/API pass** — HRM, Attendance/Payroll, Production/IE, QA, Procurement,
   Inventory, ISO/IMS, Maintenance, Commercial/Finance — check each against its PDF section.
4. **Deployment truth check** — a real `npm install` + boot test (this sandbox has no network access
   to npm registry, so it could not be run here; needs to be run on a machine with internet access
   before go-live).
5. **Responsibility-by-employee mapping** — the PDF defines the fields but not a literal
   employee-by-employee assignment; that has to come from your actual organization data, not be
   invented.

This log will be updated at the end of each phase with what was checked, what was fixed, and what
still needs real infrastructure/credentials/your business data to close out.
