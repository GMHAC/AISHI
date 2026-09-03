const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'rizvi_dreams.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ============================================================
// USERS  (login accounts — role based: admin | director | employee)
// ============================================================
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_code TEXT UNIQUE,          -- login username, links to employees.employee_code
  name TEXT NOT NULL,
  password TEXT,                      -- bcrypt hash; NULL for passwordless 'employee' self-service accounts
  role TEXT NOT NULL DEFAULT 'employee', -- 'admin' | 'director' | 'department_admin' | 'section_admin' | 'employee'
  scope_type TEXT,                    -- 'department' | 'section' — which kind of scope this account is limited to (NULL for admin/director/employee)
  scope_value TEXT,                   -- the specific department name or section name this account may act on
  must_change_password INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`);
try { db.exec(`ALTER TABLE users ADD COLUMN scope_type TEXT;`); } catch (e) { /* exists */ }
try { db.exec(`ALTER TABLE users ADD COLUMN scope_value TEXT;`); } catch (e) { /* exists */ }
db.exec(`CREATE INDEX IF NOT EXISTS idx_users_scope ON users(scope_type, scope_value);`);

// ============================================================
// EMPLOYEES  (master data — imported from HR CSV export)
// ============================================================
db.exec(`
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_code TEXT UNIQUE NOT NULL,   -- e.g. "AF1 0001"
  punched_id TEXT,
  full_name TEXT NOT NULL,
  name_bn TEXT,
  join_date TEXT,
  department TEXT,
  category TEXT,
  section TEXT,
  sub_section TEXT,
  designation TEXT,
  job_location TEXT,
  status TEXT DEFAULT 'Active',         -- Active | Inactive | Terminated
  job_termination_type TEXT,
  termination_date TEXT,
  gross_salary REAL,
  phone TEXT,
  whatsapp TEXT,
  national_id TEXT,
  birth_certificate TEXT,
  bank_account TEXT,
  bank_account_no TEXT,
  routing_number TEXT,
  blood_group TEXT,
  gender TEXT,
  religion TEXT,
  job_type TEXT,
  birth_date TEXT,
  payment_mode TEXT,
  email TEXT,
  number_of_child INTEGER,
  nationality TEXT,
  weekend TEXT,
  payroll_type TEXT,
  grade TEXT,
  job_division TEXT,
  shift_name TEXT,
  transport_service TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(full_name);`);

// ============================================================
// ATTENDANCE
// ============================================================
db.exec(`
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  date TEXT NOT NULL,                   -- YYYY-MM-DD
  status TEXT NOT NULL DEFAULT 'present', -- present | absent | leave | holiday
  check_in TEXT,
  check_out TEXT,
  ot_hours REAL DEFAULT 0,
  remarks TEXT,
  marked_by INTEGER,                    -- users.id
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(employee_id, date),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL
);
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);`);

// worked_hours = total net hours actually worked that day (general + OT), used for weekly 72hr signal.
try { db.exec(`ALTER TABLE attendance ADD COLUMN worked_hours REAL DEFAULT 0;`); } catch (e) { /* column already exists */ }

// GPS location tracking columns — self-service punch in/out from the employee's phone.
// Phone-number/GSM-based location is not possible without a telecom operator API, so this
// uses the device's own GPS (navigator.geolocation) instead — live when online, queued
// client-side and synced automatically once the connection returns.
try { db.exec(`ALTER TABLE attendance ADD COLUMN check_in_lat REAL;`); } catch (e) { /* exists */ }
try { db.exec(`ALTER TABLE attendance ADD COLUMN check_in_lng REAL;`); } catch (e) { /* exists */ }
try { db.exec(`ALTER TABLE attendance ADD COLUMN check_in_accuracy REAL;`); } catch (e) { /* exists */ }
try { db.exec(`ALTER TABLE attendance ADD COLUMN check_in_source TEXT;`); } catch (e) { /* exists: 'gps' | 'manual' | 'admin' */ }
try { db.exec(`ALTER TABLE attendance ADD COLUMN check_out_lat REAL;`); } catch (e) { /* exists */ }
try { db.exec(`ALTER TABLE attendance ADD COLUMN check_out_lng REAL;`); } catch (e) { /* exists */ }
try { db.exec(`ALTER TABLE attendance ADD COLUMN check_out_accuracy REAL;`); } catch (e) { /* exists */ }
try { db.exec(`ALTER TABLE attendance ADD COLUMN check_out_source TEXT;`); } catch (e) { /* exists */ }
try { db.exec(`ALTER TABLE attendance ADD COLUMN punched_offline INTEGER DEFAULT 0;`); } catch (e) { /* exists: 1 if synced late from an offline queue */ }

// ============================================================
// SALARY MASTER  (monthly salary sheet import — reconciled against attendance OT)
// ============================================================
db.exec(`
CREATE TABLE IF NOT EXISTS salary_master (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  month TEXT NOT NULL,                  -- 'YYYY-MM'
  basic REAL DEFAULT 0,
  gross_salary REAL DEFAULT 0,
  ot_hours REAL DEFAULT 0,              -- OT hours as per imported salary sheet
  ot_rate REAL DEFAULT 0,
  ot_amount REAL DEFAULT 0,
  other_allowance REAL DEFAULT 0,
  deductions REAL DEFAULT 0,
  net_payable REAL DEFAULT 0,
  source_file TEXT,
  imported_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(employee_id, month),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (imported_by) REFERENCES users(id) ON DELETE SET NULL
);
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_salary_month ON salary_master(month);`);

// ============================================================
// TRAINING RECORDS  (imported from scanned/PDF/Word/Excel training docs)
// ============================================================
db.exec(`
CREATE TABLE IF NOT EXISTS training_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  training_name TEXT NOT NULL,
  training_date TEXT,                   -- as imported, may be 'DD-Mon-YY' or ISO
  category TEXT,                         -- e.g. Fire Safety, Compliance, POSH, OHS, Machine Safety
  source_file TEXT,
  imported_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (imported_by) REFERENCES users(id) ON DELETE SET NULL
);
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_training_employee ON training_records(employee_id);`);

// ============================================================
// COMPLAINTS / SUGGESTIONS  (with optional voice / file attachment)
// ============================================================
db.exec(`
CREATE TABLE IF NOT EXISTS complaints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER,                  -- NULL allowed for anonymous submissions
  type TEXT NOT NULL DEFAULT 'complaint', -- complaint | suggestion
  subject TEXT NOT NULL,
  body TEXT,
  attachment_path TEXT,                 -- voice note / photo / document
  attachment_type TEXT,                 -- audio | image | document
  is_anonymous INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | in_review | resolved | rejected
  resolution_note TEXT,
  resolved_by INTEGER,
  resolved_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);
`);

// ============================================================
// KPI DAILY CHECKLIST  (Yes / No / Partial — Partial requires a note)
// ============================================================
db.exec(`
CREATE TABLE IF NOT EXISTS checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  department TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
`);
// designation: when set, this task template applies to every employee holding that designation
// (so all Sr. Officers / Officers / Managers etc. in that role share the same daily task list).
// weight: relative weight of this task within the employee's 100-mark daily score (default equal split).
try { db.exec(`ALTER TABLE checklist_items ADD COLUMN designation TEXT;`); } catch (e) { /* exists */ }
try { db.exec(`ALTER TABLE checklist_items ADD COLUMN weight REAL DEFAULT 1;`); } catch (e) { /* exists */ }

db.exec(`
CREATE TABLE IF NOT EXISTS checklist_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  checklist_item_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  answer TEXT NOT NULL,                 -- yes | no | partial
  note TEXT,                            -- mandatory when answer = 'partial'
  submitted_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(employee_id, checklist_item_id, date),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (checklist_item_id) REFERENCES checklist_items(id) ON DELETE CASCADE,
  FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL
);
`);

// ============================================================
// POLICY DOCUMENTS
// ============================================================
db.exec(`
CREATE TABLE IF NOT EXISTS policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT,
  file_path TEXT NOT NULL,
  uploaded_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);
`);


// ============================================================
// RIZVI FOMS REAL-TIME OPERATIONAL SYNC STATE
// Stores the shared workflow/checklist/update snapshot used by the web command center.
// ============================================================
db.exec(`
CREATE TABLE IF NOT EXISTS rizvi_sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by INTEGER,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
`);


// ============================================================
// AUDIT LOGS — immutable operational trace
// ============================================================
db.exec(`
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id TEXT,
  old_value TEXT,
  new_value TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);`);

// Operational settings (approval windows, company controls, feature flags)
db.exec(`
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
`);


// ============================================================
// ENTERPRISE OPERATIONAL CONTROL TABLES
// These tables are the normalized operational event layer. In production,
// migrate them to managed PostgreSQL; SQLite is retained for local/pilot use.
// ============================================================
db.exec(`
CREATE TABLE IF NOT EXISTS enterprise_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  module TEXT NOT NULL,
  employee_code TEXT,
  department TEXT,
  section TEXT,
  designation TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open',
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_ent_events_module ON enterprise_events(module, created_at);
CREATE INDEX IF NOT EXISTS idx_ent_events_employee ON enterprise_events(employee_code, created_at);
CREATE INDEX IF NOT EXISTS idx_ent_events_status ON enterprise_events(status, created_at);

CREATE TABLE IF NOT EXISTS employee_responsibility_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_code TEXT NOT NULL UNIQUE,
  department TEXT,
  section TEXT,
  designation TEXT,
  reporting_to TEXT,
  job_responsibility TEXT,
  authority_level TEXT,
  approval_authority TEXT,
  kpi TEXT,
  required_competency TEXT,
  training_requirement TEXT,
  daily_responsibility TEXT,
  weekly_responsibility TEXT,
  monthly_responsibility TEXT,
  iso_responsibility TEXT,
  applicable_checklist TEXT,
  assigned_workflow TEXT,
  task_template TEXT,
  document_access TEXT,
  dashboard_access TEXT,
  permission_level TEXT,
  source TEXT DEFAULT 'configured-master',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_resp_designation ON employee_responsibility_profiles(designation);
`);

// ============================================================
// CAPA / CONTINUAL IMPROVEMENT ENGINE
// One shared engine for Quality, Compliance, Safety, HR, IT and Audit —
// per instruction: "একই CAPA engine Quality, Compliance, Safety, HR, IT,
// Audit — সব জায়গায় ব্যবহার করা যাবে।"
// Lifecycle: Problem/Incident -> NC -> Root Cause -> Corrective Action ->
// Preventive Action -> Responsible Person -> Deadline -> Evidence ->
// Verification -> Closure.
// ============================================================
db.exec(`
CREATE TABLE IF NOT EXISTS capa_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_module TEXT NOT NULL,             -- quality | compliance | safety | hr | it | audit | checklist | buyer | production ...
  source_type TEXT NOT NULL DEFAULT 'finding', -- finding | incident | nc | checklist_nc
  source_reference_id INTEGER,             -- e.g. checklist_responses.id or audit finding id
  department TEXT,
  section TEXT,
  problem TEXT NOT NULL,                   -- Problem / Incident description
  nc_description TEXT,                     -- Non-Conformity statement
  root_cause TEXT,
  corrective_action TEXT,
  preventive_action TEXT,
  severity TEXT NOT NULL DEFAULT 'minor',  -- minor | major | critical
  responsible_person INTEGER,              -- employees.id
  deadline TEXT,                           -- YYYY-MM-DD target/due date
  evidence TEXT,                           -- uploaded evidence file path/URL
  status TEXT NOT NULL DEFAULT 'open',     -- open | in_progress | pending_verification | verified | closed
  raised_by INTEGER,
  verified_by INTEGER,
  verified_at TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (responsible_person) REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (raised_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_capa_status ON capa_records(status, deadline);
CREATE INDEX IF NOT EXISTS idx_capa_module ON capa_records(source_module, created_at);
CREATE INDEX IF NOT EXISTS idx_capa_department ON capa_records(department, section);
`);

// ============================================================
// RISK MANAGEMENT — per department
// Risk -> Probability -> Impact -> Risk Score -> Control -> Responsible -> Action -> Review
// ============================================================
db.exec(`
CREATE TABLE IF NOT EXISTS risk_register (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department TEXT NOT NULL,
  section TEXT,
  risk_description TEXT NOT NULL,
  probability INTEGER NOT NULL,            -- 1-5
  impact INTEGER NOT NULL,                 -- 1-5
  risk_score INTEGER NOT NULL,             -- probability * impact (computed at write time)
  control_measure TEXT,
  responsible_person INTEGER,
  action TEXT,
  review_date TEXT,
  status TEXT NOT NULL DEFAULT 'open',     -- open | mitigated | closed
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (responsible_person) REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_risk_department ON risk_register(department, section);
CREATE INDEX IF NOT EXISTS idx_risk_score ON risk_register(risk_score DESC);
`);

// ---------- Checklist Smart Center: category + frequency (per instruction's
// Daily/Weekly/Monthly/Periodic/ISO/Buyer/Legal-Regulatory/Internal/Department/
// Employee-Responsibility checklist tabs) ----------
try { db.exec(`ALTER TABLE checklist_items ADD COLUMN category TEXT NOT NULL DEFAULT 'department';`); } catch (e) { /* exists */ }
try { db.exec(`ALTER TABLE checklist_items ADD COLUMN frequency TEXT NOT NULL DEFAULT 'daily';`); } catch (e) { /* exists */ }
// is_nc_critical: when an item marked TRUE gets a 'no' response, it is treated as a
// Non-Conformity and automatically opens a draft CAPA record (see routes/checklist.js).
try { db.exec(`ALTER TABLE checklist_items ADD COLUMN is_nc_critical INTEGER NOT NULL DEFAULT 0;`); } catch (e) { /* exists */ }
// section: which of the 156 sections this item belongs to (in addition to department/designation scoping).
try { db.exec(`ALTER TABLE checklist_items ADD COLUMN section TEXT;`); } catch (e) { /* exists */ }

// ============================================================
// AUDIT MANAGEMENT — Universal Audit Engine
// Internal / External / Buyer / ISO / Social / Safety / Compliance /
// Environmental / Financial / IT / Process audits — one engine.
// Workflow: Audit Plan -> Checklist -> Audit -> Finding -> NC -> Root Cause
// -> CAPA -> Responsible -> Due Date -> Evidence -> Verification -> Closure.
// Root-cause-onward is handled by the shared capa_records engine — a
// finding marked as NC opens (or links to) a capa_records row instead of
// duplicating those fields here.
// ============================================================
db.exec(`
CREATE TABLE IF NOT EXISTS audit_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_type TEXT NOT NULL,                -- internal | external | buyer | iso | social | safety | compliance | environmental | financial | it | process
  title TEXT NOT NULL,
  department TEXT,
  section TEXT,
  scheduled_date TEXT,
  auditor TEXT,                            -- internal employee name or external auditor/organization name
  checklist_category TEXT,                 -- ties the audit to a checklist_items.category (e.g. 'iso', 'buyer')
  status TEXT NOT NULL DEFAULT 'planned',  -- planned | in_progress | completed | cancelled
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_plans_type ON audit_plans(audit_type, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_audit_plans_status ON audit_plans(status);

CREATE TABLE IF NOT EXISTS audit_findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_plan_id INTEGER NOT NULL,
  finding_description TEXT NOT NULL,
  is_nc INTEGER NOT NULL DEFAULT 0,        -- 1 if this finding is a Non-Conformity
  severity TEXT NOT NULL DEFAULT 'minor',  -- minor | major | critical
  capa_id INTEGER,                         -- set once escalated into the shared CAPA engine
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (audit_plan_id) REFERENCES audit_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (capa_id) REFERENCES capa_records(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_findings_plan ON audit_findings(audit_plan_id);
CREATE INDEX IF NOT EXISTS idx_audit_findings_nc ON audit_findings(is_nc);
`);

// ============================================================
// VIDEO CONFERENCE SCHEDULING
// Department/Section admins and Management can schedule a conference and
// share a join link; participants are notified by department/section/
// designation/employee/organization-wide scope, same targeting model as
// circulars below.
// ============================================================
db.exec(`
CREATE TABLE IF NOT EXISTS video_conferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_start TEXT NOT NULL,          -- ISO datetime
  scheduled_end TEXT,
  join_link TEXT,                         -- external meeting URL (Jitsi/Zoom/Meet etc.)
  target_type TEXT NOT NULL DEFAULT 'department', -- department | section | designation | organization
  target_value TEXT,                      -- e.g. a specific department/section/designation name; NULL when organization-wide
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | ongoing | completed | cancelled
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_video_conf_time ON video_conferences(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_video_conf_target ON video_conferences(target_type, target_value);
`);

// ============================================================
// MANAGEMENT COMMUNICATION / DIGITAL CIRCULAR SYSTEM
// Notice/Message/PDF/Excel/Word/Image/Audio/Voice/Video/Presentation,
// targeted to Employee/Department/Section/Designation/whole organization,
// with per-recipient read/listen/watch/download/acknowledge tracking so
// management can see Total Sent -> Delivered -> Viewed -> Not Viewed ->
// Acknowledged -> Pending.
// ============================================================
db.exec(`
CREATE TABLE IF NOT EXISTS circulars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  message TEXT,
  attachment_url TEXT,
  attachment_type TEXT,                   -- pdf | excel | word | image | audio | voice | video | presentation | other
  target_type TEXT NOT NULL DEFAULT 'organization', -- employee | department | section | designation | organization
  target_value TEXT,                      -- NULL for organization-wide
  requires_acknowledgement INTEGER NOT NULL DEFAULT 0,
  sent_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_circulars_target ON circulars(target_type, target_value);

CREATE TABLE IF NOT EXISTS circular_reads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circular_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread',  -- unread | read | listened | watched | downloaded | acknowledged
  acknowledged_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(circular_id, employee_id),
  FOREIGN KEY (circular_id) REFERENCES circulars(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_circular_reads_emp ON circular_reads(employee_id, status);
`);

// ============================================================
// HRM — FULL EMPLOYEE LIFECYCLE MANAGEMENT
// Manpower Requisition -> Recruitment -> Interview -> Selection -> Joining ->
// Employee Master -> Probation -> Confirmation -> Transfer -> Promotion ->
// Increment -> Training -> Performance -> Disciplinary -> Separation ->
// Final Settlement -> Alumni.
// (Employee Master, Training, Performance/KPI already exist as their own
// tables — this section covers the stages that had no table at all.)
// ============================================================
db.exec(`
CREATE TABLE IF NOT EXISTS manpower_requisitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department TEXT NOT NULL,
  section TEXT,
  designation TEXT NOT NULL,
  number_of_positions INTEGER NOT NULL DEFAULT 1,
  justification TEXT,
  requested_by INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected | fulfilled | cancelled
  approved_by INTEGER,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_requisition_status ON manpower_requisitions(status, department);

CREATE TABLE IF NOT EXISTS recruitment_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requisition_id INTEGER,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  cv_path TEXT,                              -- uploaded CV file reference
  applied_for_designation TEXT,
  stage TEXT NOT NULL DEFAULT 'cv_received', -- cv_received | shortlisted | interview_scheduled | interviewed | selected | offer_sent | joined | rejected | withdrawn
  interview_date TEXT,
  interview_notes TEXT,
  selection_notes TEXT,
  offered_salary REAL,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (requisition_id) REFERENCES manpower_requisitions(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_candidate_stage ON recruitment_candidates(stage);
CREATE INDEX IF NOT EXISTS idx_candidate_requisition ON recruitment_candidates(requisition_id);

-- One unified, append-only history log for every employment-status change:
-- transfer, promotion, demotion, increment, department/section/designation change,
-- probation -> confirmation. Keeping "what changed / old value -> new value" generic
-- (like audit_logs) avoids five near-identical tables for what is really one concept:
-- an employee's position/status changed on a date, for a reason, approved by someone.
CREATE TABLE IF NOT EXISTS employee_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,        -- probation | confirmation | transfer | promotion | demotion | increment | department_change | section_change | designation_change
  effective_date TEXT NOT NULL,
  old_value TEXT,                  -- e.g. old department/designation/salary, as text
  new_value TEXT,                  -- e.g. new department/designation/salary, as text
  reason TEXT,
  approved_by INTEGER,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_emp_history_employee ON employee_history(employee_id, effective_date);
CREATE INDEX IF NOT EXISTS idx_emp_history_type ON employee_history(event_type);

CREATE TABLE IF NOT EXISTS employee_separations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL UNIQUE,
  separation_type TEXT NOT NULL,   -- resignation | termination | contract_end | retirement
  notice_date TEXT,
  last_working_date TEXT,
  reason TEXT,
  exit_interview_notes TEXT,
  final_settlement_amount REAL,
  final_settlement_status TEXT NOT NULL DEFAULT 'pending', -- pending | processed | paid
  service_certificate_issued INTEGER NOT NULL DEFAULT 0,
  experience_certificate_issued INTEGER NOT NULL DEFAULT 0,
  processed_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL
);
`);

// ============================================================
// PRODUCTION MANAGEMENT + IE & PERFORMANCE + PLANNING
// Production Order -> Line Plan -> Daily/Hourly Production -> Target vs
// Achievement -> Efficiency, DHU, Rejection, Alter, Rework, WIP.
// Planning cycle: Annual -> Monthly -> Weekly -> Daily -> Hourly, and
// Plan -> Actual -> Achievement -> Failure -> Reason -> Adjustment ->
// Re-plan -> Revised Target.
// IE: SMV/SAM (Operation Bulletin/Time Study) feeds the target used to
// compute efficiency on each daily production report.
// ============================================================
db.exec(`
CREATE TABLE IF NOT EXISTS production_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  line_name TEXT NOT NULL,
  department TEXT NOT NULL,
  section TEXT,
  capacity_per_hour INTEGER,          -- rated line capacity, pcs/hour
  manpower_count INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_prod_lines_dept ON production_lines(department);

CREATE TABLE IF NOT EXISTS production_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  style TEXT NOT NULL,
  buyer TEXT,
  po_number TEXT,
  order_quantity INTEGER NOT NULL,
  department TEXT NOT NULL,
  line_id INTEGER,
  planned_start_date TEXT,
  planned_end_date TEXT,
  status TEXT NOT NULL DEFAULT 'planning',  -- planning | in_production | completed | shipped | cancelled
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (line_id) REFERENCES production_lines(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_prod_orders_status ON production_orders(status, department);
CREATE INDEX IF NOT EXISTS idx_prod_orders_po ON production_orders(po_number);

-- SMV/SAM per style-operation (Time Study / Operation Bulletin). Used to derive the expected
-- pcs/hour target that daily_production_reports' efficiency % is measured against.
CREATE TABLE IF NOT EXISTS smv_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  style TEXT NOT NULL,
  operation_name TEXT NOT NULL,
  smv_minutes REAL NOT NULL,          -- Standard Minute Value
  target_pcs_per_hour REAL,           -- typically 60/SMV, adjustable for line efficiency assumption
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_smv_style ON smv_records(style);

-- Planning Cycle (Annual/Monthly/Weekly/Daily/Hourly): Plan -> Actual -> Achievement % ->
-- Failure -> Reason -> Adjustment -> Re-plan -> Revised Target, one row per cycle-instance.
CREATE TABLE IF NOT EXISTS production_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  production_order_id INTEGER NOT NULL,
  plan_type TEXT NOT NULL,            -- annual | monthly | weekly | daily | hourly
  plan_date TEXT NOT NULL,            -- the date (or date+hour marker) this plan instance covers
  planned_qty INTEGER NOT NULL,
  actual_qty INTEGER,                 -- filled in once the period closes
  achievement_pct REAL,               -- computed: actual_qty / planned_qty * 100
  failure_reason TEXT,
  recovery_plan TEXT,
  revised_target INTEGER,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (production_order_id) REFERENCES production_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_prod_plans_order ON production_plans(production_order_id, plan_type, plan_date);

-- Daily/Hourly production tracking with quality metrics.
CREATE TABLE IF NOT EXISTS daily_production_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  production_order_id INTEGER NOT NULL,
  line_id INTEGER,
  report_date TEXT NOT NULL,
  report_hour INTEGER,                -- 0-23, NULL for a whole-day summary row
  target_qty INTEGER NOT NULL DEFAULT 0,
  achieved_qty INTEGER NOT NULL DEFAULT 0,
  dhu REAL,                           -- Defects per Hundred Units
  rejection_qty INTEGER NOT NULL DEFAULT 0,
  alter_qty INTEGER NOT NULL DEFAULT 0,
  rework_qty INTEGER NOT NULL DEFAULT 0,
  wip_qty INTEGER NOT NULL DEFAULT 0,
  manpower_present INTEGER,
  efficiency_pct REAL,                -- computed: achieved_qty / target_qty * 100
  reported_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (production_order_id) REFERENCES production_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (line_id) REFERENCES production_lines(id) ON DELETE SET NULL,
  FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_daily_prod_order ON daily_production_reports(production_order_id, report_date);
CREATE INDEX IF NOT EXISTS idx_daily_prod_line ON daily_production_reports(line_id, report_date);
`);

// ============================================================
// PROCUREMENT MANAGEMENT (Supplier -> RFQ -> Quotation -> Comparative
// Statement -> Purchase Requisition -> PO -> Approval -> Supplier
// Performance) covering Fabric / Accessories / General procurement, and
// INVENTORY & STORE MANAGEMENT (Item Master -> Receive/Issue/Return/
// Transfer -> Stock Count -> Reorder), connected so an approved+received PO
// automatically posts a stock receipt.
// ============================================================
db.exec(`
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',  -- fabric | accessories | general | machine | service
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  evaluation_score REAL,                     -- 0-100, Supplier Evaluation / Supplier Performance
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_suppliers_category ON suppliers(category);

CREATE TABLE IF NOT EXISTS purchase_requisitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',  -- fabric | accessories | general
  item_description TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT,
  justification TEXT,
  requested_by INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | approved | rejected | converted_to_po | cancelled
  approved_by INTEGER,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_pr_status ON purchase_requisitions(status, department);

-- RFQ / Quotation / Comparative Statement: one or more supplier quotes per requisition;
-- the comparative statement is simply "all quotations for a requisition, side by side"
-- (a query, not a separate table) once more than one supplier has quoted.
CREATE TABLE IF NOT EXISTS quotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requisition_id INTEGER NOT NULL,
  supplier_id INTEGER NOT NULL,
  quoted_unit_price REAL NOT NULL,
  quoted_delivery_date TEXT,
  notes TEXT,
  is_selected INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (requisition_id) REFERENCES purchase_requisitions(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_quotations_requisition ON quotations(requisition_id);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number TEXT UNIQUE,
  requisition_id INTEGER,
  supplier_id INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  item_description TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  total_amount REAL NOT NULL,
  expected_delivery_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft',      -- draft | approved | sent | partially_received | received | cancelled
  approved_by INTEGER,
  approved_at TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (requisition_id) REFERENCES purchase_requisitions(id) ON DELETE SET NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status, category);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);

-- ---------- INVENTORY & STORE ----------
CREATE TABLE IF NOT EXISTS warehouses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',   -- central | fabric | accessories | general
  location TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_code TEXT UNIQUE NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',  -- fabric | accessories | general
  unit TEXT NOT NULL DEFAULT 'pcs',
  barcode TEXT,
  reorder_level REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inv_items_category ON inventory_items(category);

-- Every stock movement (Receive/Issue/Return/Transfer/Adjustment from a physical Stock Count) is
-- one append-only row; current on-hand balance is derived by summing signed quantities rather than
-- stored redundantly, so it can never drift out of sync with the transaction history.
CREATE TABLE IF NOT EXISTS stock_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  warehouse_id INTEGER NOT NULL,
  transaction_type TEXT NOT NULL,   -- receive | issue | return | transfer_in | transfer_out | adjustment
  quantity REAL NOT NULL,           -- always positive; sign is implied by transaction_type
  reference TEXT,                   -- PO number / issue doc number / stock count reference
  po_id INTEGER,
  department TEXT,                  -- for 'issue' transactions: which department drew the stock
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT,
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
  FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_stock_txn_item ON stock_transactions(item_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_txn_type ON stock_transactions(transaction_type, created_at);
`);

// ============================================================
// INTEGRATED ISO MANAGEMENT SYSTEM
// Standard-wise compliance matrix (ISO 9001/14001/45001/27001/50001/37301)
// + proper Document Control (ISO 9001 clause 7.5.3: unique ID, version
// control, approval before issue, periodic review, controlled
// distribution/acknowledgement, obsolete-document handling) — replacing
// the old flat `policies` upload list, which had none of that.
// A non-compliant clause can open a record in the shared CAPA engine, same
// pattern as checklist/audit/buyer non-conformities in earlier phases.
// ============================================================
db.exec(`
CREATE TABLE IF NOT EXISTS iso_standards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,           -- ISO_9001 | ISO_14001 | ISO_45001 | ISO_27001 | ISO_50001 | ISO_37301
  name TEXT NOT NULL,
  certification_status TEXT NOT NULL DEFAULT 'not_applicable', -- not_applicable | pursuing | certified | expired
  certificate_expiry_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS iso_clause_compliance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  standard_code TEXT NOT NULL,
  clause_number TEXT NOT NULL,
  clause_description TEXT,
  department TEXT,
  compliance_status TEXT NOT NULL DEFAULT 'in_progress', -- compliant | non_compliant | not_applicable | in_progress
  evidence TEXT,
  capa_id INTEGER,                    -- set when a non-compliant clause opens a CAPA record
  last_reviewed_date TEXT,
  reviewed_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (standard_code) REFERENCES iso_standards(code) ON DELETE CASCADE,
  FOREIGN KEY (capa_id) REFERENCES capa_records(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_iso_clause_standard ON iso_clause_compliance(standard_code, compliance_status);

CREATE TABLE IF NOT EXISTS controlled_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_code TEXT UNIQUE NOT NULL,  -- unique identification (ISO 9001 7.5.3.a)
  title TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'sop', -- policy | sop | work_instruction | form | record | manual
  department TEXT,
  version TEXT NOT NULL DEFAULT '1.0',
  status TEXT NOT NULL DEFAULT 'draft', -- draft | under_review | approved | published | obsolete
  owner_id INTEGER,                    -- employees.id — the document owner
  approved_by INTEGER,
  approved_at TEXT,
  effective_date TEXT,
  next_review_date TEXT,
  file_path TEXT,
  supersedes_id INTEGER,               -- previous version this document replaces
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner_id) REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (supersedes_id) REFERENCES controlled_documents(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_ctrl_docs_status ON controlled_documents(status, department);
CREATE INDEX IF NOT EXISTS idx_ctrl_docs_review ON controlled_documents(next_review_date);

-- Controlled distribution + read acknowledgement, same pattern as circular_reads.
CREATE TABLE IF NOT EXISTS document_acknowledgments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  acknowledged_at TEXT,
  UNIQUE(document_id, employee_id),
  FOREIGN KEY (document_id) REFERENCES controlled_documents(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_doc_ack_employee ON document_acknowledgments(employee_id);
`);

module.exports = db;
