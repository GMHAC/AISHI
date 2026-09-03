const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { authenticate, requireAdminOrDirector } = require('../middleware/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads', 'complaints');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, safe);
  },
});
const upload = multer({ storage, limits: { fileSize: 60 * 1024 * 1024 } }); // 60MB max (voice/video notes)

function detectAttachmentType(mimetype = '') {
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('image/')) return 'image';
  return 'document';
}

router.use(authenticate);

// ---------- Submit a complaint or suggestion (any logged-in user) ----------
router.post('/', upload.single('attachment'), (req, res) => {
  const { subject, body, type, is_anonymous } = req.body;
  if (!subject) return res.status(400).json({ error: 'বিষয় (subject) আবশ্যক' });

  const employee = db.prepare('SELECT * FROM employees WHERE employee_code = ?').get(req.user.employee_code);
  const anonymous = is_anonymous === 'true' || is_anonymous === true;

  const attachment_path = req.file ? `/uploads/complaints/${req.file.filename}` : null;
  const attachment_type = req.file ? detectAttachmentType(req.file.mimetype) : null;

  const info = db.prepare(`
    INSERT INTO complaints (employee_id, type, subject, body, attachment_path, attachment_type, is_anonymous)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    anonymous ? null : (employee ? employee.id : null),
    type === 'suggestion' ? 'suggestion' : 'complaint',
    subject, body || null, attachment_path, attachment_type, anonymous ? 1 : 0
  );

  const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ complaint });
});

// ---------- List complaints ----------
// Admin/Director: see all. Employee: only their own (non-anonymous) submissions.
router.get('/', (req, res) => {
  const { status = '', type = '' } = req.query;
  let where = ' WHERE 1=1';
  const params = [];

  if (req.user.role === 'employee') {
    const employee = db.prepare('SELECT * FROM employees WHERE employee_code = ?').get(req.user.employee_code);
    where += ' AND employee_id = ?';
    params.push(employee ? employee.id : -1);
  }
  if (status) { where += ' AND status = ?'; params.push(status); }
  if (type) { where += ' AND type = ?'; params.push(type); }

  const rows = db.prepare(`
    SELECT c.*, e.full_name AS employee_name, e.employee_code AS employee_code
    FROM complaints c LEFT JOIN employees e ON e.id = c.employee_id
    ${where} ORDER BY c.created_at DESC
  `).all(...params);

  res.json({ complaints: rows });
});

// ---------- Aggregate dashboard stats (admin/director only) ----------
router.get('/stats/summary', requireAdminOrDirector, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) AS n FROM complaints').get().n;

  const statusMap = { pending: 0, in_review: 0, resolved: 0, rejected: 0 };
  db.prepare('SELECT status, COUNT(*) AS n FROM complaints GROUP BY status').all()
    .forEach((r) => { statusMap[r.status] = r.n; });

  const typeMap = { complaint: 0, suggestion: 0 };
  db.prepare('SELECT type, COUNT(*) AS n FROM complaints GROUP BY type').all()
    .forEach((r) => { typeMap[r.type] = r.n; });

  const by_department = db.prepare(`
    SELECT COALESCE(e.department, 'অজানা/Anonymous') AS department, COUNT(*) AS n
    FROM complaints c LEFT JOIN employees e ON e.id = c.employee_id
    GROUP BY department ORDER BY n DESC LIMIT 8
  `).all();

  const monthly_trend = db.prepare(`
    SELECT substr(created_at, 1, 7) AS month, COUNT(*) AS n
    FROM complaints GROUP BY month ORDER BY month DESC LIMIT 6
  `).all().reverse();

  const avg = db.prepare(`
    SELECT AVG(julianday(resolved_at) - julianday(created_at)) AS avg_days
    FROM complaints WHERE resolved_at IS NOT NULL
  `).get().avg_days;

  res.json({
    total,
    by_status: statusMap,
    by_type: typeMap,
    by_department,
    monthly_trend,
    avg_resolution_days: avg ? Math.round(avg * 10) / 10 : null,
  });
});

// ---------- Update status / resolve (admin/director only) ----------
router.put('/:id', requireAdminOrDirector, (req, res) => {
  const existing = db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'অভিযোগ পাওয়া যায়নি' });

  const { status, resolution_note } = req.body;
  const validStatuses = ['pending', 'in_review', 'resolved', 'rejected'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'অবৈধ status' });
  }

  db.prepare(`
    UPDATE complaints SET
      status = COALESCE(?, status),
      resolution_note = COALESCE(?, resolution_note),
      resolved_by = CASE WHEN ? IN ('resolved','rejected') THEN ? ELSE resolved_by END,
      resolved_at = CASE WHEN ? IN ('resolved','rejected') THEN datetime('now') ELSE resolved_at END
    WHERE id = ?
  `).run(status || null, resolution_note || null, status, req.user.id, status, req.params.id);

  res.json({ complaint: db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id) });
});

module.exports = router;
