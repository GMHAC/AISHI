const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate, requireAdmin);

router.get('/', (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const action = req.query.action ? String(req.query.action) : null;
  const rows = action
    ? db.prepare(`SELECT * FROM audit_logs WHERE action = ? ORDER BY id DESC LIMIT ? OFFSET ?`).all(action, limit, offset)
    : db.prepare(`SELECT * FROM audit_logs ORDER BY id DESC LIMIT ? OFFSET ?`).all(limit, offset);
  res.json({ rows, limit, offset });
});

router.get('/health', (req, res) => res.json({ ok: true, rows: db.prepare('SELECT COUNT(*) AS n FROM audit_logs').get().n }));
module.exports = router;
