// ============================================================
// CAPA / Continual Improvement Engine
// One shared engine used by Quality, Compliance, Safety, HR, IT, Audit, and
// checklist non-conformities — per instruction:
//   "একই CAPA engine Quality, Compliance, Safety, HR, IT, Audit — সব জায়গায়
//    ব্যবহার করা যাবে।"
// Lifecycle: Problem/Incident -> NC -> Root Cause -> Corrective Action ->
// Preventive Action -> Responsible Person -> Deadline -> Evidence ->
// Verification -> Closure.
// ============================================================
const express = require('express');
const db = require('../db');
const { authenticate, requireAdminOrDirector } = require('../middleware/auth');
const { audit } = require('../lib/audit');

const router = express.Router();
router.use(authenticate);

const STATUSES = ['open', 'in_progress', 'pending_verification', 'verified', 'closed'];
const SEVERITIES = ['minor', 'major', 'critical'];
const SOURCE_MODULES = ['quality', 'compliance', 'safety', 'hr', 'it', 'audit', 'checklist', 'buyer', 'production', 'other'];

// ---------- List / filter ----------
// GET /api/capa?status=open&severity=major&department=...&source_module=...&overdue=1
router.get('/', (req, res) => {
  const { status, severity, department, source_module, overdue } = req.query;
  let query = 'SELECT * FROM capa_records WHERE 1=1';
  const params = [];
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (severity) { query += ' AND severity = ?'; params.push(severity); }
  if (department) { query += ' AND department = ?'; params.push(department); }
  if (source_module) { query += ' AND source_module = ?'; params.push(source_module); }
  if (overdue === '1') {
    query += " AND status NOT IN ('verified','closed') AND deadline IS NOT NULL AND deadline < date('now')";
  }
  query += ' ORDER BY CASE severity WHEN \'critical\' THEN 0 WHEN \'major\' THEN 1 ELSE 2 END, deadline IS NULL, deadline ASC';
  res.json({ records: db.prepare(query).all(...params) });
});

// ---------- Dashboard summary (open/overdue/by severity/by module) ----------
router.get('/dashboard', (req, res) => {
  const bySeverity = db.prepare(`
    SELECT severity, COUNT(*) AS n FROM capa_records WHERE status NOT IN ('verified','closed') GROUP BY severity
  `).all();
  const byModule = db.prepare(`
    SELECT source_module, COUNT(*) AS n FROM capa_records WHERE status NOT IN ('verified','closed') GROUP BY source_module
  `).all();
  const overdue = db.prepare(`
    SELECT COUNT(*) AS n FROM capa_records
    WHERE status NOT IN ('verified','closed') AND deadline IS NOT NULL AND deadline < date('now')
  `).get().n;
  const totalOpen = db.prepare(`SELECT COUNT(*) AS n FROM capa_records WHERE status NOT IN ('verified','closed')`).get().n;
  const closedThisMonth = db.prepare(`
    SELECT COUNT(*) AS n FROM capa_records WHERE status = 'closed' AND strftime('%Y-%m', closed_at) = strftime('%Y-%m', 'now')
  `).get().n;
  res.json({ total_open: totalOpen, overdue, by_severity: bySeverity, by_module: byModule, closed_this_month: closedThisMonth });
});

router.get('/:id', (req, res) => {
  const record = db.prepare('SELECT * FROM capa_records WHERE id = ?').get(req.params.id);
  if (!record) return res.status(404).json({ error: 'CAPA রেকর্ড পাওয়া যায়নি' });
  res.json({ record });
});

// ---------- Create (Problem/Incident/NC raised) ----------
router.post('/', (req, res) => {
  const {
    source_module, source_type = 'finding', source_reference_id = null,
    department, section = null, problem, nc_description = null,
    severity = 'minor', responsible_person = null, deadline = null,
  } = req.body;

  if (!source_module || !SOURCE_MODULES.includes(source_module)) {
    return res.status(400).json({ error: `source_module must be one of: ${SOURCE_MODULES.join(', ')}` });
  }
  if (!department) return res.status(400).json({ error: 'department আবশ্যক' });
  if (!problem || !problem.trim()) return res.status(400).json({ error: 'problem (Problem/Incident description) আবশ্যক' });
  if (!SEVERITIES.includes(severity)) return res.status(400).json({ error: `severity must be one of: ${SEVERITIES.join(', ')}` });

  const info = db.prepare(`
    INSERT INTO capa_records (source_module, source_type, source_reference_id, department, section, problem, nc_description, severity, responsible_person, deadline, status, raised_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
  `).run(source_module, source_type, source_reference_id, department, section, problem.trim(), nc_description, severity, responsible_person, deadline, req.user.id);

  const record = db.prepare('SELECT * FROM capa_records WHERE id = ?').get(info.lastInsertRowid);
  audit(req, { action: 'CAPA_CREATE', tableName: 'capa_records', recordId: record.id, newValue: record });
  res.status(201).json({ record });
});

// ---------- Root cause / corrective / preventive action (Root Cause -> Corrective -> Preventive) ----------
router.put('/:id/action', requireAdminOrDirector, (req, res) => {
  const existing = db.prepare('SELECT * FROM capa_records WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'CAPA রেকর্ড পাওয়া যায়নি' });
  if (['verified', 'closed'].includes(existing.status)) {
    return res.status(400).json({ error: 'বন্ধ/verified CAPA-তে root cause / action আপডেট করা যাবে না' });
  }

  const { root_cause, corrective_action, preventive_action, responsible_person, deadline } = req.body;
  const fields = [];
  const params = [];
  for (const [k, v] of Object.entries({ root_cause, corrective_action, preventive_action, responsible_person, deadline })) {
    if (v !== undefined) { fields.push(`${k} = ?`); params.push(v); }
  }
  if (!fields.length) return res.status(400).json({ error: 'আপডেট করার মতো কোনো তথ্য দেওয়া হয়নি' });

  // Moving from 'open' to 'in_progress' once a root cause / corrective action exists.
  if (existing.status === 'open' && (root_cause || corrective_action)) {
    fields.push('status = ?'); params.push('in_progress');
  }
  fields.push("updated_at = datetime('now')");
  params.push(req.params.id);

  db.prepare(`UPDATE capa_records SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  const record = db.prepare('SELECT * FROM capa_records WHERE id = ?').get(req.params.id);
  audit(req, { action: 'CAPA_ACTION_UPDATE', tableName: 'capa_records', recordId: record.id, oldValue: existing, newValue: record });
  res.json({ record });
});

// ---------- Submit evidence + request verification (Evidence -> pending_verification) ----------
router.put('/:id/evidence', (req, res) => {
  const existing = db.prepare('SELECT * FROM capa_records WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'CAPA রেকর্ড পাওয়া যায়নি' });
  const { evidence } = req.body;
  if (!evidence || !evidence.trim()) return res.status(400).json({ error: 'evidence আবশ্যক' });

  db.prepare(`
    UPDATE capa_records SET evidence = ?, status = 'pending_verification', updated_at = datetime('now') WHERE id = ?
  `).run(evidence.trim(), req.params.id);

  const record = db.prepare('SELECT * FROM capa_records WHERE id = ?').get(req.params.id);
  audit(req, { action: 'CAPA_EVIDENCE_SUBMIT', tableName: 'capa_records', recordId: record.id, oldValue: existing, newValue: record });
  res.json({ record });
});

// ---------- Verify + close (Verification -> Closure) ----------
router.put('/:id/verify', requireAdminOrDirector, (req, res) => {
  const existing = db.prepare('SELECT * FROM capa_records WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'CAPA রেকর্ড পাওয়া যায়নি' });
  if (existing.status !== 'pending_verification') {
    return res.status(400).json({ error: 'শুধুমাত্র pending_verification অবস্থার CAPA verify করা যাবে' });
  }
  const { approved, close } = req.body; // approved: bool; close: bool (auto-close on verify)

  if (approved === false) {
    db.prepare(`UPDATE capa_records SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
  } else {
    const closeNow = close !== false;
    db.prepare(`
      UPDATE capa_records SET status = ?, verified_by = ?, verified_at = datetime('now'),
        closed_at = CASE WHEN ? THEN datetime('now') ELSE closed_at END, updated_at = datetime('now')
      WHERE id = ?
    `).run(closeNow ? 'closed' : 'verified', req.user.id, closeNow ? 1 : 0, req.params.id);
  }

  const record = db.prepare('SELECT * FROM capa_records WHERE id = ?').get(req.params.id);
  audit(req, { action: 'CAPA_VERIFY', tableName: 'capa_records', recordId: record.id, oldValue: existing, newValue: record });
  res.json({ record });
});

module.exports = router;
