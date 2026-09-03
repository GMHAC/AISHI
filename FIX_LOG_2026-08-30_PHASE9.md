# RIZVI FOMS — Phase 9 Audit & Fix Log (2026-08-30)

## Scope: Integrated ISO Management System
Instruction section 11 — standard-wise compliance matrix (ISO 9001/14001/45001/27001/50001/37301)
and proper Document Control (instruction items 73-74, 90).

## Real gap found
The only document-related feature in the codebase was `policies`: title + category + a single
file_path, no version, no approval workflow, no review cycle, no distribution tracking. That is a
file upload list, not Document Control in the ISO 9001 clause 7.5.3 sense (unique identification,
version control, approval before issue, periodic review, controlled distribution/acknowledgement,
prevention of unintended use of obsolete documents). No ISO standards/clause compliance tracking
existed at all.

## Built in this pass (`routes/iso-management.js`, 4 new tables in `db.js`)
1. **ISO Standards matrix** — the six standards named in the instruction, each with a
   certification_status (not_applicable/pursuing/certified/expired) and certificate expiry.
   Auto-seeds on first read so the matrix always shows all six even before anyone touches it.
2. **Clause-level compliance tracking** — standard + clause number + department + status
   (compliant/non_compliant/not_applicable/in_progress) + evidence.
3. **Non-compliant clause → CAPA auto-link** — marking a clause `non_compliant` opens a record in
   the Phase-2 CAPA engine, same pattern as checklist NCs, audit findings, and buyer complaints.
   One CAPA engine now has four different feeders, all consistent.
4. **Compliance dashboard** — % compliant per standard, list of open non-conformities still
   unresolved in CAPA.
5. **Proper Document Control**: unique document_code, version, owner, draft→under_review→approved→
   published→obsolete lifecycle, next_review_date.
6. **Version supersession**: publishing a new version automatically marks the document it
   supersedes as `obsolete` — so only one version is ever "published" at a time, directly
   implementing "prevention of unintended use of obsolete documents."
7. **Controlled distribution + acknowledgement**: publishing fans out an acknowledgement row per
   active employee in the document's department (same fan-out pattern as circulars in Phase 4);
   management can query total/acknowledged/pending per document.
8. **Documents due for review** (next 30 days) — the periodic-review half of Document Control.

## Verification performed
- `node --check` clean on every changed file.
- **Full backend sweep this phase**: ran `node --check` against every single `.js` file in
  `routes/`, `middleware/`, `lib/`, `scripts/`, plus `db.js` and `server.js` — the entire backend
  built across all 9 phases — confirmed zero syntax errors anywhere, not just the newest files.
- `db.exec(\`` / closing `` `); `` count re-verified balanced (50/50).
- Full realistic flow validated against real SQLite: seed ISO 9001 → certify it → add clause 7.5.3
  → mark it non_compliant (confirmed CAPA record opens and links back) → dashboard queries (both
  returned correct compliance % and the open non-conformity) → create a document → approve →
  publish → distribute to 2 employees → one acknowledges (1/2 correctly reflected) → publish a v2.0
  that supersedes it (confirmed v1 automatically flips to `obsolete`, v2 stays `published`) →
  review-due query (correctly empty, since the review date is a year out). Every step correct.
- No live server boot possible in this sandbox — same standing note every phase.

## Running total (Phases 1–9)
Image bug fix · CAPA · Risk Register · Checklist NC engine · Universal Audit Engine · Section/
Department Admin roles · passwordless Employee login · Video Conferences · Circular broadcast ·
Buyer Complaint→CAPA · full HRM lifecycle · Production/IE/Planning · Procurement↔Inventory ·
ISO/IMS compliance matrix + real Document Control. Five different non-conformity sources (checklist,
audit, buyer complaint, ISO clause) now all feed the same CAPA engine consistently.

## Still not done — full honest picture
1. **Frontend wiring** — nothing from Phases 1–9 is called from `index.html` yet. This is now, by
   far, the largest remaining gap: a complete backend exists for CAPA, Risk, Audit, Roles,
   Conferences, Circulars, HRM, Production, Procurement, Inventory, and ISO/Document Control, and
   none of it has a screen.
2. Fabric-specific inspection (4-point system etc.), Traceability, and the rest of Marketing &
   Merchandising beyond the Phase 5 complaint link — still on the generic `enterprise_events` layer.
3. Master Dashboard role-based views (MD/GM Production/GM HR/Department Head/Employee).
4. A real `npm install` + boot test + running the seed scripts on a machine with internet access —
   nothing in Phases 1–9 has actually been run as a live server yet, only verified at the
   syntax/SQL level.

Given the size of what's left (#1 above is genuinely as much work as everything already done), the
honest next step is to either continue module-by-module (Fabric/Traceability next) or shift to
frontend wiring so what's built so far becomes usable — happy to go either way, just flagging that
"complete" from here is a large amount of remaining work either direction.
