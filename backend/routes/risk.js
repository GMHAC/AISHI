// ============================================================
// RISK MANAGEMENT
// Per department: Risk -> Probability -> Impact -> Risk Score -> Control ->
// Responsible Person -> Action -> Review. Risk Register + Risk Dashboard.
// ============================================================
const express = require('express');
const db = require('../db');
const { authenticate, requireAdminOrDirector } = require('../middleware/auth');
const { audit } = require('../lib/audit');

const router = express.Router();
router.use(authenticate);

// ---------- Risk Register (list/filter) ----------
// GET /api/risk?department=...&status=open&min_score=15
router.get('/', (req, res) => {
  const { department, status, min_score } = req.query;
  let query = 'SELECT * FROM risk_register WHERE 1=1';
  const params = [];
  if (department) { query += ' AND department = ?'; params.push(department); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (min_score) { query += ' AND risk_score >= ?'; params.push(Number(min_score)); }
  query += ' ORDER BY risk_score DESC, review_date ASC';
  res.json({ risks: db.prepare(query).all(...params) });
});

// ---------- Risk Dashboard (heat-map style summary) ----------
router.get('/dashboard', (req, res) => {
  const byDepartment = db.prepare(`
    SELECT department, COUNT(*) AS n, AVG(risk_score) AS avg_score, MAX(risk_score) AS max_score
    FROM risk_register WHERE status != 'closed' GROUP BY department ORDER BY max_score DESC
  `).all();
  const critical = db.prepare(`SELECT * FROM risk_register WHERE status != 'closed' AND risk_score >= 15 ORDER BY risk_score DESC`).all();
  const dueForReview = db.prepare(`
    SELECT * FROM risk_register WHERE status != 'closed' AND review_date IS NOT NULL AND review_date <= date('now', '+7 days')
    ORDER BY review_date ASC
  `).all();
  res.json({ by_department: byDepartment, critical_risks: critical, due_for_review: dueForReview });
});

router.get('/:id', (req, res) => {
  const risk = db.prepare('SELECT * FROM risk_register WHERE id = ?').get(req.params.id);
  if (!risk) return res.status(404).json({ error: 'ঝুঁকি রেকর্ড পাওয়া যায়নি' });
  res.json({ risk });
});

// ---------- Create ----------
router.post('/', requireAdminOrDirector, (req, res) => {
  const { department, section = null, risk_description, probability, impact, control_measure = null, responsible_person = null, action = null, review_date = null } = req.body;

  if (!department) return res.status(400).json({ error: 'department আবশ্যক' });
  if (!risk_description || !risk_description.trim()) return res.status(400).json({ error: 'risk_description আবশ্যক' });
  const p = Number(probability), im = Number(impact);
  if (!Number.isInteger(p) || p < 1 || p > 5) return res.status(400).json({ error: 'probability 1-5 এর মধ্যে একটি পূর্ণসংখ্যা হতে হবে' });
  if (!Number.isInteger(im) || im < 1 || im > 5) return res.status(400).json({ error: 'impact 1-5 এর মধ্যে একটি পূর্ণসংখ্যা হতে হবে' });

  const riskScore = p * im;
  const info = db.prepare(`
    INSERT INTO risk_register (department, section, risk_description, probability, impact, risk_score, control_measure, responsible_person, action, review_date, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
  `).run(department, section, risk_description.trim(), p, im, riskScore, control_measure, responsible_person, action, review_date, req.user.id);

  const risk = db.prepare('SELECT * FROM risk_register WHERE id = ?').get(info.lastInsertRowid);
  audit(req, { action: 'RISK_CREATE', tableName: 'risk_register', recordId: risk.id, newValue: risk });
  res.status(201).json({ risk });
});

// ---------- Update (control measure / responsible / action / review, recompute score) ----------
router.put('/:id', requireAdminOrDirector, (req, res) => {
  const existing = db.prepare('SELECT * FROM risk_register WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'ঝুঁকি রেকর্ড পাওয়া যায়নি' });

  const { probability, impact, control_measure, responsible_person, action, review_date, status } = req.body;
  const p = probability !== undefined ? Number(probability) : existing.probability;
  const im = impact !== undefined ? Number(impact) : existing.impact;
  if (!Number.isInteger(p) || p < 1 || p > 5) return res.status(400).json({ error: 'probability 1-5 এর মধ্যে একটি পূর্ণসংখ্যা হতে হবে' });
  if (!Number.isInteger(im) || im < 1 || im > 5) return res.status(400).json({ error: 'impact 1-5 এর মধ্যে একটি পূর্ণসংখ্যা হতে হবে' });
  if (status && !['open', 'mitigated', 'closed'].includes(status)) return res.status(400).json({ error: 'status must be open, mitigated, or closed' });

  db.prepare(`
    UPDATE risk_register SET probability = ?, impact = ?, risk_score = ?, control_measure = ?, responsible_person = ?, action = ?, review_date = ?, status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(p, im, p * im, control_measure ?? existing.control_measure, responsible_person ?? existing.responsible_person, action ?? existing.action, review_date ?? existing.review_date, status || existing.status, req.params.id);

  const risk = db.prepare('SELECT * FROM risk_register WHERE id = ?').get(req.params.id);
  audit(req, { action: 'RISK_UPDATE', tableName: 'risk_register', recordId: risk.id, oldValue: existing, newValue: risk });
  res.json({ risk });
});

module.exports = router;
