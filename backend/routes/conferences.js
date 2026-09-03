// ============================================================
// VIDEO CONFERENCE SCHEDULING
// Section Admin / Department Admin / Director can schedule a conference for
// their own department/section (or organization-wide, management only) and
// share a join link. This module handles scheduling + attendee visibility;
// the actual video call runs through an external meeting link (Jitsi/Zoom/
// Google Meet etc.) placed in join_link.
// ============================================================
const express = require('express');
const db = require('../db');
const { authenticate, requireManagement, requireScopeAccess } = require('../middleware/auth');
const { audit } = require('../lib/audit');

const router = express.Router();
router.use(authenticate);

const TARGET_TYPES = ['department', 'section', 'designation', 'organization'];

// ---------- Create / schedule ----------
router.post('/', requireManagement, requireScopeAccess(
  (req) => (req.body.target_type === 'department' ? req.body.target_value : null),
  (req) => (req.body.target_type === 'section' ? req.body.target_value : null),
), (req, res) => {
  const { title, description = null, scheduled_start, scheduled_end = null, join_link = null, target_type = 'department', target_value = null } = req.body;

  if (!title || !title.trim()) return res.status(400).json({ error: 'title আবশ্যক' });
  if (!scheduled_start) return res.status(400).json({ error: 'scheduled_start আবশ্যক' });
  if (!TARGET_TYPES.includes(target_type)) return res.status(400).json({ error: `target_type must be one of: ${TARGET_TYPES.join(', ')}` });
  if (target_type !== 'organization' && !target_value) return res.status(400).json({ error: 'target_value আবশ্যক (organization ছাড়া বাকি সব ক্ষেত্রে)' });
  // Only admin/director may schedule an organization-wide conference.
  if (target_type === 'organization' && !['admin', 'director'].includes(req.user.role)) {
    return res.status(403).json({ error: 'শুধুমাত্র Admin/Director organization-wide conference schedule করতে পারবেন' });
  }

  const info = db.prepare(`
    INSERT INTO video_conferences (title, description, scheduled_start, scheduled_end, join_link, target_type, target_value, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)
  `).run(title.trim(), description, scheduled_start, scheduled_end, join_link, target_type, target_value, req.user.id);

  const conference = db.prepare('SELECT * FROM video_conferences WHERE id = ?').get(info.lastInsertRowid);
  audit(req, { action: 'CONFERENCE_CREATE', tableName: 'video_conferences', recordId: conference.id, newValue: conference });
  res.status(201).json({ conference });
});

// ---------- List (upcoming by default) — every authenticated user can see conferences relevant to them ----------
router.get('/', (req, res) => {
  const { department, section, designation, upcoming_only } = req.query;
  let query = 'SELECT * FROM video_conferences WHERE 1=1';
  const params = [];

  const orClauses = ["target_type = 'organization'"];
  if (department) { orClauses.push("(target_type = 'department' AND target_value = ?)"); params.push(department); }
  if (section) { orClauses.push("(target_type = 'section' AND target_value = ?)"); params.push(section); }
  if (designation) { orClauses.push("(target_type = 'designation' AND target_value = ?)"); params.push(designation); }
  query += ` AND (${orClauses.join(' OR ')})`;

  if (upcoming_only !== '0') query += " AND status IN ('scheduled','ongoing') AND scheduled_start >= datetime('now', '-1 hour')";
  query += ' ORDER BY scheduled_start ASC';

  res.json({ conferences: db.prepare(query).all(...params) });
});

router.get('/:id', (req, res) => {
  const conference = db.prepare('SELECT * FROM video_conferences WHERE id = ?').get(req.params.id);
  if (!conference) return res.status(404).json({ error: 'Conference পাওয়া যায়নি' });
  res.json({ conference });
});

// ---------- Update status (start / complete / cancel) ----------
router.put('/:id/status', requireManagement, (req, res) => {
  const existing = db.prepare('SELECT * FROM video_conferences WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Conference পাওয়া যায়নি' });

  if (!['admin', 'director'].includes(req.user.role)) {
    const scopeOk = (existing.target_type === 'department' && existing.target_value === req.user.scope_value)
      || (existing.target_type === 'section' && existing.target_value === req.user.scope_value);
    if (!scopeOk) return res.status(403).json({ error: 'এই conference-এর উপর আপনার অনুমতি নেই' });
  }

  const { status } = req.body;
  if (!['scheduled', 'ongoing', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'status must be scheduled, ongoing, completed, or cancelled' });
  }
  db.prepare(`UPDATE video_conferences SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, req.params.id);
  const conference = db.prepare('SELECT * FROM video_conferences WHERE id = ?').get(req.params.id);
  audit(req, { action: 'CONFERENCE_STATUS', tableName: 'video_conferences', recordId: conference.id, oldValue: existing, newValue: conference });
  res.json({ conference });
});

module.exports = router;
