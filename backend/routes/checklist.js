const express = require('express');
const db = require('../db');
const { authenticate, requireAdminOrDirector, requireManagement, requireScopeAccess } = require('../middleware/auth');
const { audit } = require('../lib/audit');

const router = express.Router();
router.use(authenticate);

// Smart Checklist Center categories (instruction: Daily/Weekly/Monthly/Periodic/ISO/
// Buyer/Legal-Regulatory/Internal/Department/Employee-Responsibility checklist tabs).
const CATEGORIES = ['iso', 'buyer', 'legal_regulatory', 'internal', 'department', 'employee_responsibility'];
const FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly', 'half_yearly', 'annual', 'periodic'];

// ---------- Checklist item templates ----------
router.get('/items', (req, res) => {
  const { department = '', designation = '', category = '', frequency = '' } = req.query;
  let query = 'SELECT * FROM checklist_items WHERE is_active = 1';
  const params = [];
  if (department) { query += ' AND (department = ? OR department IS NULL)'; params.push(department); }
  if (designation) { query += ' AND (designation = ? OR designation IS NULL)'; params.push(designation); }
  if (category) { query += ' AND category = ?'; params.push(category); }
  if (frequency) { query += ' AND frequency = ?'; params.push(frequency); }
  res.json({ items: db.prepare(query + ' ORDER BY id').all(...params) });
});

// ---------- Full item list for the admin customization panel (includes inactive items) ----------
router.get('/items/all', requireManagement, (req, res) => {
  let { department = '', designation = '' } = req.query;
  // Scoped admins are auto-restricted to their own department/section regardless of query params.
  if (req.user.role === 'department_admin') department = req.user.scope_value;
  let query = 'SELECT * FROM checklist_items WHERE 1=1';
  const params = [];
  if (department) { query += ' AND (department = ? OR department IS NULL)'; params.push(department); }
  if (designation) { query += ' AND (designation = ? OR designation IS NULL)'; params.push(designation); }
  if (req.user.role === 'section_admin') { query += ' AND (section = ? OR section IS NULL)'; params.push(req.user.scope_value); }
  res.json({ items: db.prepare(query + ' ORDER BY is_active DESC, id DESC').all(...params) });
});

router.post('/items', requireManagement, requireScopeAccess(
  (req) => req.body.department, (req) => req.body.section,
), (req, res) => {
  const { title, department, section, designation, weight, category = 'department', frequency = 'daily', is_nc_critical = false } = req.body;
  if (!title) return res.status(400).json({ error: 'title আবশ্যক' });
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
  if (!FREQUENCIES.includes(frequency)) return res.status(400).json({ error: `frequency must be one of: ${FREQUENCIES.join(', ')}` });
  const info = db.prepare(`
    INSERT INTO checklist_items (title, department, section, designation, weight, category, frequency, is_nc_critical)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, department || null, section || null, designation || null, weight || 1, category, frequency, is_nc_critical ? 1 : 0);
  res.status(201).json({ item: db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(info.lastInsertRowid) });
});

router.delete('/items/:id', requireManagement, (req, res) => {
  const existing = db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'আইটেম পাওয়া যায়নি' });
  if (req.user.role === 'department_admin' && existing.department !== req.user.scope_value) {
    return res.status(403).json({ error: `আপনি শুধুমাত্র "${req.user.scope_value}" ডিপার্টমেন্টের আইটেম নিষ্ক্রিয় করতে পারবেন` });
  }
  if (req.user.role === 'section_admin' && existing.section !== req.user.scope_value) {
    return res.status(403).json({ error: `আপনি শুধুমাত্র "${req.user.scope_value}" সেকশনের আইটেম নিষ্ক্রিয় করতে পারবেন` });
  }
  db.prepare('UPDATE checklist_items SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'চেকলিস্ট আইটেম নিষ্ক্রিয় করা হয়েছে' });
});

// ---------- Edit an item (title/department/designation/weight/is_active) — admin customization panel ----------
router.put('/items/:id', requireManagement, (req, res) => {
  const existing = db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'আইটেম পাওয়া যায়নি' });
  if (req.user.role === 'department_admin' && existing.department !== req.user.scope_value) {
    return res.status(403).json({ error: `আপনি শুধুমাত্র "${req.user.scope_value}" ডিপার্টমেন্টের আইটেম সম্পাদনা করতে পারবেন` });
  }
  if (req.user.role === 'section_admin' && existing.section !== req.user.scope_value) {
    return res.status(403).json({ error: `আপনি শুধুমাত্র "${req.user.scope_value}" সেকশনের আইটেম সম্পাদনা করতে পারবেন` });
  }

  const fields = ['title', 'department', 'section', 'designation', 'weight', 'is_active', 'category', 'frequency', 'is_nc_critical'];
  const updates = [];
  const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(['is_active', 'is_nc_critical'].includes(f) ? (req.body[f] ? 1 : 0) : (req.body[f] === '' ? null : req.body[f]));
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'আপডেট করার মতো কোনো তথ্য দেওয়া হয়নি' });
  params.push(req.params.id);

  db.prepare(`UPDATE checklist_items SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ item: db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(req.params.id) });
});

// ---------- Submit responses for an employee on a date ----------
// body: { employee_id, date, responses: [{ checklist_item_id, answer: 'yes'|'no'|'partial', note }] }
router.post('/responses', (req, res) => {
  const { employee_id, date, responses } = req.body;
  if (!employee_id || !date || !Array.isArray(responses)) {
    return res.status(400).json({ error: 'employee_id, date, responses[] আবশ্যক' });
  }

  for (const r of responses) {
    if (!['yes', 'no', 'partial'].includes(r.answer)) {
      return res.status(400).json({ error: `অবৈধ উত্তর: ${r.answer}` });
    }
    if (r.answer === 'partial' && (!r.note || !r.note.trim())) {
      return res.status(400).json({ error: 'Partial উত্তরের জন্য নোট আবশ্যক (mandatory note required)' });
    }
  }

  const stmt = db.prepare(`
    INSERT INTO checklist_responses (employee_id, checklist_item_id, date, answer, note, submitted_by)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(employee_id, checklist_item_id, date) DO UPDATE SET
      answer = excluded.answer, note = excluded.note, submitted_by = excluded.submitted_by
  `);

  // Non-Conformity auto-escalation: an 'is_nc_critical' item answered 'no' is a Non-Conformity
  // (instruction: checklist statuses include "🔴 Non-Conformity") and automatically opens a
  // draft CAPA record via the shared CAPA/Continual-Improvement engine, instead of silently
  // recording a failed checklist item with no follow-up.
  const capaInsert = db.prepare(`
    INSERT INTO capa_records (source_module, source_type, source_reference_id, department, section, problem, nc_description, severity, status, raised_by)
    VALUES ('checklist', 'checklist_nc', ?, ?, ?, ?, ?, 'major', 'open', ?)
  `);
  const existingCapaForItem = db.prepare(`
    SELECT id FROM capa_records WHERE source_type = 'checklist_nc' AND source_reference_id = ? AND status NOT IN ('verified','closed')
  `);

  const insertMany = db.transaction((rows) => {
    const openedCapaIds = [];
    for (const r of rows) {
      stmt.run(employee_id, r.checklist_item_id, date, r.answer, r.note || null, req.user.id);
      if (r.answer === 'no') {
        const item = db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(r.checklist_item_id);
        if (item && item.is_nc_critical && !existingCapaForItem.get(r.checklist_item_id)) {
          const info = capaInsert.run(
            r.checklist_item_id, item.department, item.section,
            `Checklist non-conformity: "${item.title}"`,
            `Employee #${employee_id} answered 'no' on ${date} for a designated NC-critical checklist item.`,
            req.user.id
          );
          openedCapaIds.push(info.lastInsertRowid);
        }
      }
    }
    return openedCapaIds;
  });
  const openedCapaIds = insertMany(responses);

  const saved = db.prepare(`
    SELECT cr.*, ci.title FROM checklist_responses cr
    JOIN checklist_items ci ON ci.id = cr.checklist_item_id
    WHERE cr.employee_id = ? AND cr.date = ?
  `).all(employee_id, date);

  res.status(201).json({ responses: saved, capa_opened: openedCapaIds });
});

// ---------- Status summary for an employee/date: Pending / Completed / Overdue / Non-Conformity ----------
// GET /api/checklist/status/:employeeId/:date
router.get('/status/:employeeId/:date', (req, res) => {
  const { employeeId, date } = req.params;
  const employee = db.prepare('SELECT department, designation FROM employees WHERE id = ?').get(employeeId);
  if (!employee) return res.status(404).json({ error: 'কর্মী পাওয়া যায়নি' });

  const items = db.prepare(`
    SELECT * FROM checklist_items WHERE is_active = 1
      AND (department = ? OR department IS NULL) AND (designation = ? OR designation IS NULL)
  `).all(employee.department, employee.designation);

  const responses = db.prepare(`SELECT * FROM checklist_responses WHERE employee_id = ? AND date = ?`).all(employeeId, date);
  const byItem = Object.fromEntries(responses.map((r) => [r.checklist_item_id, r]));
  const isPastDate = date < new Date().toISOString().slice(0, 10);

  const rows = items.map((item) => {
    const r = byItem[item.id];
    let status;
    if (!r) status = isPastDate ? 'overdue' : 'pending';
    else if (item.is_nc_critical && r.answer === 'no') status = 'non_conformity';
    else status = 'completed';
    return { checklist_item_id: item.id, title: item.title, category: item.category, frequency: item.frequency, status, answer: r ? r.answer : null };
  });

  res.json({
    employee_id: Number(employeeId), date,
    counts: {
      pending: rows.filter((r) => r.status === 'pending').length,
      completed: rows.filter((r) => r.status === 'completed').length,
      overdue: rows.filter((r) => r.status === 'overdue').length,
      non_conformity: rows.filter((r) => r.status === 'non_conformity').length,
    },
    items: rows,
  });
});

// ---------- Get responses for an employee/date ----------
router.get('/responses/:employeeId/:date', (req, res) => {
  const rows = db.prepare(`
    SELECT cr.*, ci.title FROM checklist_responses cr
    JOIN checklist_items ci ON ci.id = cr.checklist_item_id
    WHERE cr.employee_id = ? AND cr.date = ?
  `).all(req.params.employeeId, req.params.date);
  res.json({ responses: rows });
});

module.exports = router;
