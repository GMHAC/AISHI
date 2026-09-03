// ============================================================
// AUDIT MANAGEMENT — Universal Audit Engine
// Internal / External / Buyer / ISO / Social / Safety / Compliance /
// Environmental / Financial / IT / Process audits.
// Workflow: Audit Plan -> Checklist -> Audit -> Finding -> NC -> Root Cause
// -> CAPA -> Responsible -> Due Date -> Evidence -> Verification -> Closure.
// Findings marked as Non-Conformity automatically open a record in the
// shared CAPA engine (routes/capa.js) — root cause onward lives there so
// the two engines never drift out of sync.
// ============================================================
const express = require('express');
const db = require('../db');
const { authenticate, requireAdminOrDirector } = require('../middleware/auth');
const { audit } = require('../lib/audit');

const router = express.Router();
router.use(authenticate);

const AUDIT_TYPES = ['internal', 'external', 'buyer', 'iso', 'social', 'safety', 'compliance', 'environmental', 'financial', 'it', 'process'];
const PLAN_STATUSES = ['planned', 'in_progress', 'completed', 'cancelled'];
const SEVERITIES = ['minor', 'major', 'critical'];

// ---------- Audit Plan: create ----------
router.post('/plans', requireAdminOrDirector, (req, res) => {
  const { audit_type, title, department = null, section = null, scheduled_date = null, auditor = null, checklist_category = null } = req.body;
  if (!audit_type || !AUDIT_TYPES.includes(audit_type)) {
    return res.status(400).json({ error: `audit_type must be one of: ${AUDIT_TYPES.join(', ')}` });
  }
  if (!title || !title.trim()) return res.status(400).json({ error: 'title আবশ্যক' });

  const info = db.prepare(`
    INSERT INTO audit_plans (audit_type, title, department, section, scheduled_date, auditor, checklist_category, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'planned', ?)
  `).run(audit_type, title.trim(), department, section, scheduled_date, auditor, checklist_category, req.user.id);

  const plan = db.prepare('SELECT * FROM audit_plans WHERE id = ?').get(info.lastInsertRowid);
  audit(req, { action: 'AUDIT_PLAN_CREATE', tableName: 'audit_plans', recordId: plan.id, newValue: plan });
  res.status(201).json({ plan });
});

// ---------- Audit Plan: list/filter ----------
router.get('/plans', (req, res) => {
  const { audit_type, status, department } = req.query;
  let query = 'SELECT * FROM audit_plans WHERE 1=1';
  const params = [];
  if (audit_type) { query += ' AND audit_type = ?'; params.push(audit_type); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (department) { query += ' AND department = ?'; params.push(department); }
  query += ' ORDER BY scheduled_date IS NULL, scheduled_date ASC';
  res.json({ plans: db.prepare(query).all(...params) });
});

// ---------- Audit Plan: detail (with findings) ----------
router.get('/plans/:id', (req, res) => {
  const plan = db.prepare('SELECT * FROM audit_plans WHERE id = ?').get(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Audit plan পাওয়া যায়নি' });
  const findings = db.prepare('SELECT * FROM audit_findings WHERE audit_plan_id = ? ORDER BY id').all(req.params.id);
  res.json({ plan, findings });
});

// ---------- Audit Plan: status transitions (planned -> in_progress -> completed / cancelled) ----------
router.put('/plans/:id/status', requireAdminOrDirector, (req, res) => {
  const existing = db.prepare('SELECT * FROM audit_plans WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Audit plan পাওয়া যায়নি' });
  const { status } = req.body;
  if (!status || !PLAN_STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of: ${PLAN_STATUSES.join(', ')}` });

  db.prepare(`UPDATE audit_plans SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, req.params.id);
  const plan = db.prepare('SELECT * FROM audit_plans WHERE id = ?').get(req.params.id);
  audit(req, { action: 'AUDIT_PLAN_STATUS', tableName: 'audit_plans', recordId: plan.id, oldValue: existing, newValue: plan });
  res.json({ plan });
});

// ---------- Finding: record a finding against a plan; NC findings auto-open a CAPA record ----------
router.post('/plans/:id/findings', (req, res) => {
  const plan = db.prepare('SELECT * FROM audit_plans WHERE id = ?').get(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Audit plan পাওয়া যায়নি' });

  const { finding_description, is_nc = false, severity = 'minor', responsible_person = null, deadline = null } = req.body;
  if (!finding_description || !finding_description.trim()) return res.status(400).json({ error: 'finding_description আবশ্যক' });
  if (!SEVERITIES.includes(severity)) return res.status(400).json({ error: `severity must be one of: ${SEVERITIES.join(', ')}` });

  let capaId = null;
  const insertFinding = db.transaction(() => {
    if (is_nc) {
      const capaInfo = db.prepare(`
        INSERT INTO capa_records (source_module, source_type, source_reference_id, department, section, problem, nc_description, severity, responsible_person, deadline, status, raised_by)
        VALUES ('audit', 'nc', ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
      `).run(req.params.id, plan.department, plan.section, `Audit finding (${plan.audit_type} audit: "${plan.title}")`, finding_description.trim(), severity, responsible_person, deadline, req.user.id);
      capaId = capaInfo.lastInsertRowid;
    }
    const info = db.prepare(`
      INSERT INTO audit_findings (audit_plan_id, finding_description, is_nc, severity, capa_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.params.id, finding_description.trim(), is_nc ? 1 : 0, severity, capaId, req.user.id);
    return info.lastInsertRowid;
  });
  const findingId = insertFinding();

  const finding = db.prepare('SELECT * FROM audit_findings WHERE id = ?').get(findingId);
  audit(req, { action: 'AUDIT_FINDING_CREATE', tableName: 'audit_findings', recordId: finding.id, newValue: finding });
  res.status(201).json({ finding, capa_opened: capaId });
});

// ---------- Dashboard: audits by type/status, open NC findings, overdue plans ----------
router.get('/dashboard', (req, res) => {
  const byType = db.prepare(`SELECT audit_type, COUNT(*) AS n FROM audit_plans WHERE status != 'cancelled' GROUP BY audit_type`).all();
  const byStatus = db.prepare(`SELECT status, COUNT(*) AS n FROM audit_plans GROUP BY status`).all();
  const openNcFindings = db.prepare(`
    SELECT af.*, ap.title AS audit_title, ap.audit_type FROM audit_findings af
    JOIN audit_plans ap ON ap.id = af.audit_plan_id
    JOIN capa_records cr ON cr.id = af.capa_id
    WHERE af.is_nc = 1 AND cr.status NOT IN ('verified','closed')
  `).all();
  const overduePlans = db.prepare(`
    SELECT * FROM audit_plans WHERE status = 'planned' AND scheduled_date IS NOT NULL AND scheduled_date < date('now')
  `).all();
  res.json({ by_type: byType, by_status: byStatus, open_nc_findings: openNcFindings, overdue_plans: overduePlans });
});

module.exports = router;
