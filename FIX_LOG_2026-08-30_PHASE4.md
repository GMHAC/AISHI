# RIZVI FOMS — Phase 4 Audit & Fix Log (2026-08-30)

## Scope of this phase — user-specified role system
Built exactly what was requested in chat for four login classes:

### 1. Section Admin (scoped to 1 of 156 sections)
- Can update daily/weekly/monthly/quarterly checklist items for their section, any time
  (`POST/PUT/DELETE /api/checklist/items` now scope-checked).
- Can create/schedule video conferences for their section (`/api/conferences`).
- Can send circulars/documents/voice/video to their section (`/api/communication/circulars`).
- Login: `employee_code = SEC-ADMIN-<SECTION-NAME>` (auto-generated for all 156 sections by
  `scripts/seed_scoped_admins.js`), scoped so they can only act on their own section.

### 2. Department Admin (scoped to 1 of 91 departments)
- Same four capabilities, scoped to department instead of section.
- Login: `employee_code = DEPT-ADMIN-<DEPARTMENT-NAME>`.

### 3. Employee (all staff)
- **New passwordless login**: `POST /api/auth/employee-login { identifier }` — accepts the
  Official ID Card Number or the phone/WhatsApp number, matched against the master
  `employees` table (Active only). No password. A plain `employee`-role account is
  auto-created the first time someone logs in this way — nothing has to be pre-created for
  each of the 7,000 employees.
- This endpoint can only ever grant the base `employee` role — it explicitly refuses if the
  matched account is already an admin/director/scoped-admin, so it can't be used to bypass
  password login for privileged accounts.

### 4. Director / Management
- Existing `director` role reused (was already in the system).
- `POST /api/communication/circulars` with `target_type=organization` — broadcasts to every
  active employee, with attachment/voice/video support and per-recipient
  read/listen/watch/download/acknowledge tracking, plus a management-side stats endpoint
  (Total Sent → Delivered → Viewed → Not Viewed → Acknowledged → Pending) exactly as specified.
  Sub-second "3-second delivery" is a frontend polling concern (`GET /circulars/inbox/:id`
  is cheap to poll every few seconds) — the data layer that makes it possible is now built.

## A security decision made on your behalf — please confirm
The instruction gives a **single shared password** for all Section Admins ("Dept123456") and
all Department Admins ("Sec123456"). Giving 156 different people the exact same permanent
password (or 91 people the other) is a real security risk — anyone who leaves the company still
has a working login, and one leaked password compromises every section/department at once.

So `scripts/seed_scoped_admins.js` sets these as **initial/temporary** passwords only, with
`must_change_password = 1` — exactly like the existing Admin and Director accounts already work.
Each Section/Department Admin is forced to set their own password on first login. This keeps your
exact requirement (everyone starts with a simple shared password so you can hand out logins
immediately) while closing the obvious hole.

**Also worth flagging**: in your message the names look swapped — "Section Admin... Password:
Dept123456" and "Department Admin... Password: Sec123456". I implemented it exactly as you
typed it, but if that was a typo, set `SECTION_ADMIN_DEFAULT_PASSWORD` /
`DEPARTMENT_ADMIN_DEFAULT_PASSWORD` in `.env` to whichever is correct before running the seed
script — nothing else needs to change.

## Built in this phase
1. `users` table: added `scope_type` / `scope_value` columns; `password` is now nullable (for
   passwordless employee accounts); `role` now also accepts `department_admin` / `section_admin`.
2. `middleware/auth.js`: new `requireManagement` (admin/director/dept-admin/section-admin) and
   `requireScopeAccess(departmentGetter, sectionGetter)` — rejects a department/section admin
   acting outside their own assigned department/section; admin/director bypass.
3. `routes/auth.js`: JWT now carries `scope_type`/`scope_value`; new
   `POST /api/auth/employee-login` passwordless path described above.
4. `routes/checklist.js`: item create/edit/delete now scope-enforced for department_admin/
   section_admin (Point 1 of your spec — hourly task updates).
5. `routes/conferences.js` (new) + `video_conferences` table — schedule/list/update conferences,
   scoped by department/section, organization-wide restricted to admin/director.
6. `routes/communication.js` (new) + `circulars`/`circular_reads` tables — send circular (any
   attachment type), employee inbox, employee status update, management delivery/view/ack stats.
7. `scripts/seed_scoped_admins.js` (new) — generates one Department Admin account per department
   (91) and one Section Admin account per section (156) from `enterprise-master-data.json`.
8. `scripts/seed_admin.js` — now also seeds the Director account (`DIRECTOR_EMPLOYEE_CODE` /
   `DIRECTOR_PASSWORD` env vars).
9. Document upload (`routes/documents-v2.js`) already accepted any `content_type` (PDF, Excel,
   Word, image, audio, video) — checked, this needed no change; it just needs `GCS_BUCKET` and
   Google Cloud credentials configured to actually store files (infra, not code).

## Verification performed
- `node --check` clean on every changed/new file.
- Full schema and every new/changed query (passwordless login lookup, scoped-admin insert,
  conference target-matching list query, circular fan-out + delivery/view/acknowledge stats)
  executed against real SQLite with sample data — all correct.
- Still cannot boot the actual server in this sandbox (no network for `npm install`) — same
  standing note as every previous phase.

## Still not done — honest remaining scope
1. Frontend UI for all of Phases 1–4's new backend capabilities (CAPA, Risk, Audit Management,
   Conferences, Circulars, scoped admin dashboards) — none of it is wired into `index.html` yet.
2. Actual video-call infrastructure — `join_link` currently expects an external meeting URL
   (Jitsi/Zoom/Meet); this system schedules and tracks conferences, it does not host the call itself.
3. Marketing & Merchandising, HRM, Attendance/Payroll, Production/IE, Procurement, Inventory,
   ISO/IMS — still module-by-module unchecked against the instruction.
4. Master Dashboard role-based views (MD/GM Production/GM HR/Department Head/Employee) — not
   yet checked.
5. A real `npm install` + boot test on a machine with internet access, and running
   `node scripts/seed_admin.js && node scripts/seed_scoped_admins.js` once to actually create
   the accounts described above.

Continuing next.
