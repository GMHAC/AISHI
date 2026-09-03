// ============================================================
// HRM — FULL EMPLOYEE LIFECYCLE MANAGEMENT
// Manpower Requisition -> Recruitment -> Interview -> Selection -> Joining ->
// Probation -> Confirmation -> Transfer -> Promotion -> Increment ->
// Disciplinary -> Separation -> Final Settlement -> Alumni.
// ============================================================
const express = require('express');
const db = require('../db');
const { authenticate, requireAdminOrDirector, requireManagement, requireScopeAccess } = require('../middleware/auth');
const { audit } = require('../lib/audit');

const router = express.Router();
router.use(authenticate);

const REQ_STATUSES = ['pending', 'approved', 'rejected', 'fulfilled', 'cancelled'];
const CANDIDATE_STAGES = ['cv_received', 'shortlisted', 'interview_scheduled', 'interviewed', 'selected', 'offer_sent', 'joined', 'rejected', 'withdrawn'];
const HISTORY_TYPES = ['probation', 'confirmation', 'transfer', 'promotion', 'demotion', 'increment', 'department_change', 'section_change', 'designation_change'];
const SEPARATION_TYPES = ['resignation', 'termination', 'contract_end', 'retirement'];

// ==================== 1. MANPOWER REQUISITION ====================
router.post('/requisitions', requireManagement, requireScopeAccess(
  (req) => req.body.department, () => null,
), (req, res) => {
  const { department, section = null, designation, number_of_positions = 1, justification = null } = req.body;
  if (!department) return res.status(400).json({ error: 'department আবশ্যক' });
  if (!designation) return res.status(400).json({ error: 'designation আবশ্যক' });
  const n = Number(number_of_positions);
  if (!Number.isInteger(n) || n < 1) return res.status(400).json({ error: 'number_of_positions একটি ধনাত্মক পূর্ণসংখ্যা হতে হবে' });

  const info = db.prepare(`
    INSERT INTO manpower_requisitions (department, section, designation, number_of_positions, justification, requested_by, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).run(department, section, designation, n, justification, req.user.id);

  const requisition = db.prepare('SELECT * FROM manpower_requisitions WHERE id = ?').get(info.lastInsertRowid);
  audit(req, { action: 'REQUISITION_CREATE', tableName: 'manpower_requisitions', recordId: requisition.id, newValue: requisition });
  res.status(201).json({ requisition });
});

router.get('/requisitions', (req, res) => {
  const { status, department } = req.query;
  let query = 'SELECT * FROM manpower_requisitions WHERE 1=1';
  const params = [];
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (department) { query += ' AND department = ?'; params.push(department); }
  query += ' ORDER BY created_at DESC';
  res.json({ requisitions: db.prepare(query).all(...params) });
});

router.put('/requisitions/:id/status', requireAdminOrDirector, (req, res) => {
  const existing = db.prepare('SELECT * FROM manpower_requisitions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Requisition পাওয়া যায়নি' });
  const { status } = req.body;
  if (!REQ_STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of: ${REQ_STATUSES.join(', ')}` });

  db.prepare(`
    UPDATE manpower_requisitions SET status = ?,
      approved_by = CASE WHEN ? = 'approved' THEN ? ELSE approved_by END,
      approved_at = CASE WHEN ? = 'approved' THEN datetime('now') ELSE approved_at END,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(status, status, req.user.id, status, req.params.id);

  const requisition = db.prepare('SELECT * FROM manpower_requisitions WHERE id = ?').get(req.params.id);
  audit(req, { action: 'REQUISITION_STATUS', tableName: 'manpower_requisitions', recordId: requisition.id, oldValue: existing, newValue: requisition });
  res.json({ requisition });
});

// ==================== 2. RECRUITMENT: CV Database -> Interview -> Selection ====================
router.post('/candidates', requireManagement, (req, res) => {
  const { requisition_id = null, full_name, phone = null, email = null, cv_path = null, applied_for_designation = null } = req.body;
  if (!full_name || !full_name.trim()) return res.status(400).json({ error: 'full_name আবশ্যক' });

  const info = db.prepare(`
    INSERT INTO recruitment_candidates (requisition_id, full_name, phone, email, cv_path, applied_for_designation, stage, created_by)
    VALUES (?, ?, ?, ?, ?, ?, 'cv_received', ?)
  `).run(requisition_id, full_name.trim(), phone, email, cv_path, applied_for_designation, req.user.id);

  const candidate = db.prepare('SELECT * FROM recruitment_candidates WHERE id = ?').get(info.lastInsertRowid);
  audit(req, { action: 'CANDIDATE_CREATE', tableName: 'recruitment_candidates', recordId: candidate.id, newValue: candidate });
  res.status(201).json({ candidate });
});

router.get('/candidates', (req, res) => {
  const { stage, requisition_id } = req.query;
  let query = 'SELECT * FROM recruitment_candidates WHERE 1=1';
  const params = [];
  if (stage) { query += ' AND stage = ?'; params.push(stage); }
  if (requisition_id) { query += ' AND requisition_id = ?'; params.push(requisition_id); }
  query += ' ORDER BY created_at DESC';
  res.json({ candidates: db.prepare(query).all(...params) });
});

// One endpoint drives Interview Management -> Selection -> Appointment/Offer,
// moving the candidate through cv_received -> ... -> joined | rejected | withdrawn.
router.put('/candidates/:id/stage', requireManagement, (req, res) => {
  const existing = db.prepare('SELECT * FROM recruitment_candidates WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Candidate পাওয়া যায়নি' });

  const { stage, interview_date, interview_notes, selection_notes, offered_salary } = req.body;
  if (stage && !CANDIDATE_STAGES.includes(stage)) return res.status(400).json({ error: `stage must be one of: ${CANDIDATE_STAGES.join(', ')}` });

  const fields = [];
  const params = [];
  for (const [k, v] of Object.entries({ stage, interview_date, interview_notes, selection_notes, offered_salary })) {
    if (v !== undefined) { fields.push(`${k} = ?`); params.push(v); }
  }
  if (!fields.length) return res.status(400).json({ error: 'আপডেট করার মতো কোনো তথ্য দেওয়া হয়নি' });
  fields.push("updated_at = datetime('now')");
  params.push(req.params.id);

  db.prepare(`UPDATE recruitment_candidates SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  const candidate = db.prepare('SELECT * FROM recruitment_candidates WHERE id = ?').get(req.params.id);
  audit(req, { action: 'CANDIDATE_STAGE', tableName: 'recruitment_candidates', recordId: candidate.id, oldValue: existing, newValue: candidate });
  res.json({ candidate });
});

// ==================== 3. EMPLOYMENT HISTORY: Probation / Confirmation / Transfer / Promotion / Demotion / Increment ====================
router.post('/employees/:employeeId/history', requireAdminOrDirector, (req, res) => {
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.employeeId);
  if (!employee) return res.status(404).json({ error: 'কর্মী পাওয়া যায়নি' });

  const { event_type, effective_date, old_value = null, new_value = null, reason = null } = req.body;
  if (!HISTORY_TYPES.includes(event_type)) return res.status(400).json({ error: `event_type must be one of: ${HISTORY_TYPES.join(', ')}` });
  if (!effective_date) return res.status(400).json({ error: 'effective_date আবশ্যক' });

  const applyToMaster = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO employee_history (employee_id, event_type, effective_date, old_value, new_value, reason, approved_by, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.employeeId, event_type, effective_date, old_value, new_value, reason, req.user.id, req.user.id);

    // Keep the employee master record in sync for the change types that map directly to a column.
    if (event_type === 'department_change' && new_value) db.prepare('UPDATE employees SET department = ?, updated_at = datetime(\'now\') WHERE id = ?').run(new_value, req.params.employeeId);
    if (event_type === 'section_change' && new_value) db.prepare('UPDATE employees SET section = ?, updated_at = datetime(\'now\') WHERE id = ?').run(new_value, req.params.employeeId);
    if (event_type === 'designation_change' && new_value) db.prepare('UPDATE employees SET designation = ?, updated_at = datetime(\'now\') WHERE id = ?').run(new_value, req.params.employeeId);
    if (['promotion', 'transfer'].includes(event_type) && new_value) db.prepare('UPDATE employees SET designation = ?, updated_at = datetime(\'now\') WHERE id = ?').run(new_value, req.params.employeeId);
    if (event_type === 'increment' && new_value) db.prepare('UPDATE employees SET gross_salary = ?, updated_at = datetime(\'now\') WHERE id = ?').run(Number(new_value) || null, req.params.employeeId);

    return info.lastInsertRowid;
  });
  const historyId = applyToMaster();

  const history = db.prepare('SELECT * FROM employee_history WHERE id = ?').get(historyId);
  audit(req, { action: 'EMPLOYEE_HISTORY_ADD', tableName: 'employee_history', recordId: history.id, newValue: history });
  res.status(201).json({ history });
});

router.get('/employees/:employeeId/history', (req, res) => {
  const rows = db.prepare('SELECT * FROM employee_history WHERE employee_id = ? ORDER BY effective_date DESC, id DESC').all(req.params.employeeId);
  res.json({ history: rows });
});

// ==================== 4. SEPARATION: Resignation / Termination / Exit Interview / Final Settlement ====================
router.post('/employees/:employeeId/separation', requireAdminOrDirector, (req, res) => {
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.employeeId);
  if (!employee) return res.status(404).json({ error: 'কর্মী পাওয়া যায়নি' });

  const { separation_type, notice_date = null, last_working_date = null, reason = null } = req.body;
  if (!SEPARATION_TYPES.includes(separation_type)) return res.status(400).json({ error: `separation_type must be one of: ${SEPARATION_TYPES.join(', ')}` });

  const existing = db.prepare('SELECT id FROM employee_separations WHERE employee_id = ?').get(req.params.employeeId);
  if (existing) return res.status(409).json({ error: 'এই কর্মীর জন্য ইতিমধ্যে একটি separation রেকর্ড রয়েছে' });

  db.prepare(`
    INSERT INTO employee_separations (employee_id, separation_type, notice_date, last_working_date, reason, processed_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.employeeId, separation_type, notice_date, last_working_date, reason, req.user.id);

  const separation = db.prepare('SELECT * FROM employee_separations WHERE employee_id = ?').get(req.params.employeeId);
  audit(req, { action: 'SEPARATION_CREATE', tableName: 'employee_separations', recordId: separation.id, newValue: separation });
  res.status(201).json({ separation });
});

// Exit interview notes, final settlement amount/status, certificates — and on 'paid' settlement,
// moves the employee to Alumni (employees.status = 'Terminated', matching the existing status enum).
router.put('/employees/:employeeId/separation', requireAdminOrDirector, (req, res) => {
  const existing = db.prepare('SELECT * FROM employee_separations WHERE employee_id = ?').get(req.params.employeeId);
  if (!existing) return res.status(404).json({ error: 'Separation রেকর্ড পাওয়া যায়নি — আগে POST করুন' });

  const { exit_interview_notes, final_settlement_amount, final_settlement_status, service_certificate_issued, experience_certificate_issued } = req.body;
  if (final_settlement_status && !['pending', 'processed', 'paid'].includes(final_settlement_status)) {
    return res.status(400).json({ error: 'final_settlement_status must be pending, processed, or paid' });
  }

  const fields = [];
  const params = [];
  for (const [k, v] of Object.entries({ exit_interview_notes, final_settlement_amount, final_settlement_status })) {
    if (v !== undefined) { fields.push(`${k} = ?`); params.push(v); }
  }
  for (const k of ['service_certificate_issued', 'experience_certificate_issued']) {
    if (req.body[k] !== undefined) { fields.push(`${k} = ?`); params.push(req.body[k] ? 1 : 0); }
  }
  if (!fields.length) return res.status(400).json({ error: 'আপডেট করার মতো কোনো তথ্য দেওয়া হয়নি' });
  fields.push("updated_at = datetime('now')");
  params.push(req.params.employeeId);

  const applySeparation = db.transaction(() => {
    db.prepare(`UPDATE employee_separations SET ${fields.join(', ')} WHERE employee_id = ?`).run(...params);
    // Once final settlement is fully paid, the employee formally becomes Alumni.
    if (final_settlement_status === 'paid') {
      db.prepare(`UPDATE employees SET status = 'Terminated', updated_at = datetime('now') WHERE id = ?`).run(req.params.employeeId);
    }
  });
  applySeparation();

  const separation = db.prepare('SELECT * FROM employee_separations WHERE employee_id = ?').get(req.params.employeeId);
  audit(req, { action: 'SEPARATION_UPDATE', tableName: 'employee_separations', recordId: separation.id, oldValue: existing, newValue: separation });
  res.json({ separation });
});

// ==================== 5. ALUMNI ====================
router.get('/alumni', requireAdminOrDirector, (req, res) => {
  const rows = db.prepare(`
    SELECT e.id, e.employee_code, e.full_name, e.department, e.designation, s.separation_type, s.last_working_date, s.final_settlement_status
    FROM employees e JOIN employee_separations s ON s.employee_id = e.id
    WHERE e.status = 'Terminated' ORDER BY s.last_working_date DESC
  `).all();
  res.json({ alumni: rows });
});

// ==================== DASHBOARD ====================
router.get('/dashboard', requireAdminOrDirector, (req, res) => {
  const openRequisitions = db.prepare(`SELECT COUNT(*) AS n FROM manpower_requisitions WHERE status IN ('pending','approved')`).get().n;
  const activePipeline = db.prepare(`SELECT COUNT(*) AS n FROM recruitment_candidates WHERE stage NOT IN ('joined','rejected','withdrawn')`).get().n;
  const pendingSettlements = db.prepare(`SELECT COUNT(*) AS n FROM employee_separations WHERE final_settlement_status != 'paid'`).get().n;
  const byCandidateStage = db.prepare(`SELECT stage, COUNT(*) AS n FROM recruitment_candidates GROUP BY stage`).all();
  res.json({ open_requisitions: openRequisitions, active_recruitment_pipeline: activePipeline, pending_final_settlements: pendingSettlements, candidates_by_stage: byCandidateStage });
});

module.exports = router;
