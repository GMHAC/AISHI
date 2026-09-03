// ============================================================
// MANAGEMENT COMMUNICATION / DIGITAL CIRCULAR SYSTEM
// Notice/Message/PDF/Excel/Word/Image/Audio/Voice/Video/Presentation sent to
// an Employee/Department/Section/Designation or the whole organization.
// Employee side: New/Unread, Read, Listen, Watch, Download, Acknowledge.
// Management side: Total Sent -> Delivered -> Viewed -> Not Viewed ->
// Acknowledged -> Pending.
// "Delivery" within 3 seconds is a real-time push/poll concern on the
// frontend (see live-dashboard.js) — this module is the data layer both
// sides read from; GET /circulars is cheap enough to poll every few seconds.
// ============================================================
const express = require('express');
const db = require('../db');
const { authenticate, requireManagement, requireScopeAccess } = require('../middleware/auth');
const { audit } = require('../lib/audit');

const router = express.Router();
router.use(authenticate);

const TARGET_TYPES = ['employee', 'department', 'section', 'designation', 'organization'];
const READ_STATUSES = ['read', 'listened', 'watched', 'downloaded', 'acknowledged'];

// ---------- Send a circular ----------
router.post('/circulars', requireManagement, requireScopeAccess(
  (req) => (req.body.target_type === 'department' ? req.body.target_value : null),
  (req) => (req.body.target_type === 'section' ? req.body.target_value : null),
), (req, res) => {
  const { title, message = null, attachment_url = null, attachment_type = null, target_type = 'organization', target_value = null, requires_acknowledgement = false } = req.body;

  if (!title || !title.trim()) return res.status(400).json({ error: 'title আবশ্যক' });
  if (!TARGET_TYPES.includes(target_type)) return res.status(400).json({ error: `target_type must be one of: ${TARGET_TYPES.join(', ')}` });
  if (target_type !== 'organization' && !target_value) return res.status(400).json({ error: 'target_value আবশ্যক (organization ছাড়া বাকি সব ক্ষেত্রে)' });
  if (target_type === 'organization' && !['admin', 'director'].includes(req.user.role)) {
    return res.status(403).json({ error: 'শুধুমাত্র Admin/Director organization-wide circular পাঠাতে পারবেন' });
  }

  const insertCircular = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO circulars (title, message, attachment_url, attachment_type, target_type, target_value, requires_acknowledgement, sent_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title.trim(), message, attachment_url, attachment_type, target_type, target_value, requires_acknowledgement ? 1 : 0, req.user.id);
    const circularId = info.lastInsertRowid;

    // Fan out an 'unread' row per matching active employee so delivery/read tracking works immediately.
    let recipientQuery = "SELECT id FROM employees WHERE status = 'Active'";
    const params = [];
    if (target_type === 'employee') { recipientQuery += ' AND id = ?'; params.push(target_value); }
    else if (target_type === 'department') { recipientQuery += ' AND department = ?'; params.push(target_value); }
    else if (target_type === 'section') { recipientQuery += ' AND section = ?'; params.push(target_value); }
    else if (target_type === 'designation') { recipientQuery += ' AND designation = ?'; params.push(target_value); }

    const recipients = db.prepare(recipientQuery).all(...params);
    const insertRead = db.prepare(`INSERT INTO circular_reads (circular_id, employee_id, status) VALUES (?, ?, 'unread')`);
    for (const r of recipients) insertRead.run(circularId, r.id);

    return { circularId, recipientCount: recipients.length };
  });

  const { circularId, recipientCount } = insertCircular();
  const circular = db.prepare('SELECT * FROM circulars WHERE id = ?').get(circularId);
  audit(req, { action: 'CIRCULAR_SEND', tableName: 'circulars', recordId: circularId, newValue: circular });
  res.status(201).json({ circular, recipient_count: recipientCount });
});

// ---------- Employee side: circulars addressed to me (via my employee_id) ----------
router.get('/circulars/inbox/:employeeId', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, cr.status AS my_status, cr.acknowledged_at
    FROM circular_reads cr
    JOIN circulars c ON c.id = cr.circular_id
    WHERE cr.employee_id = ?
    ORDER BY c.created_at DESC
  `).all(req.params.employeeId);
  res.json({ circulars: rows });
});

// ---------- Employee side: mark my status on a circular (read/listened/watched/downloaded/acknowledged) ----------
router.put('/circulars/:id/status/:employeeId', (req, res) => {
  const { status } = req.body;
  if (!READ_STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of: ${READ_STATUSES.join(', ')}` });

  const row = db.prepare('SELECT * FROM circular_reads WHERE circular_id = ? AND employee_id = ?').get(req.params.id, req.params.employeeId);
  if (!row) return res.status(404).json({ error: 'এই circular আপনার জন্য পাঠানো হয়নি' });

  db.prepare(`
    UPDATE circular_reads SET status = ?, acknowledged_at = CASE WHEN ? = 'acknowledged' THEN datetime('now') ELSE acknowledged_at END, updated_at = datetime('now')
    WHERE circular_id = ? AND employee_id = ?
  `).run(status, status, req.params.id, req.params.employeeId);

  res.json({ message: 'স্ট্যাটাস আপডেট হয়েছে' });
});

// ---------- Management side: Total Sent -> Delivered -> Viewed -> Not Viewed -> Acknowledged -> Pending ----------
router.get('/circulars/:id/stats', requireManagement, (req, res) => {
  const circular = db.prepare('SELECT * FROM circulars WHERE id = ?').get(req.params.id);
  if (!circular) return res.status(404).json({ error: 'Circular পাওয়া যায়নি' });

  const totalSent = db.prepare('SELECT COUNT(*) AS n FROM circular_reads WHERE circular_id = ?').get(req.params.id).n;
  const viewed = db.prepare(`SELECT COUNT(*) AS n FROM circular_reads WHERE circular_id = ? AND status != 'unread'`).get(req.params.id).n;
  const notViewed = totalSent - viewed;
  const acknowledged = db.prepare(`SELECT COUNT(*) AS n FROM circular_reads WHERE circular_id = ? AND status = 'acknowledged'`).get(req.params.id).n;
  const pendingAck = circular.requires_acknowledgement ? totalSent - acknowledged : 0;

  res.json({
    circular,
    total_sent: totalSent, delivered: totalSent, viewed, not_viewed: notViewed,
    acknowledged, pending_acknowledgement: pendingAck,
  });
});

// ---------- List circulars I sent (management) ----------
router.get('/circulars', requireManagement, (req, res) => {
  const rows = db.prepare('SELECT * FROM circulars ORDER BY created_at DESC LIMIT 200').all();
  res.json({ circulars: rows });
});

module.exports = router;
