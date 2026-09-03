const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads', 'policies');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, safe);
  },
});
const upload = multer({ storage, limits: { fileSize: 30 * 1024 * 1024 } });

router.use(authenticate);

// ---------- List policies (everyone) ----------
router.get('/', (req, res) => {
  res.json({ policies: db.prepare('SELECT * FROM policies ORDER BY created_at DESC').all() });
});

// ---------- Upload a policy document (admin only) ----------
router.post('/', requireAdmin, upload.single('file'), (req, res) => {
  const { title, category } = req.body;
  if (!title || !req.file) return res.status(400).json({ error: 'title এবং file আবশ্যক' });

  const file_path = `/uploads/policies/${req.file.filename}`;
  const info = db.prepare('INSERT INTO policies (title, category, file_path, uploaded_by) VALUES (?, ?, ?, ?)')
    .run(title, category || null, file_path, req.user.id);

  res.status(201).json({ policy: db.prepare('SELECT * FROM policies WHERE id = ?').get(info.lastInsertRowid) });
});

// ---------- Delete a policy (admin only) ----------
router.delete('/:id', requireAdmin, (req, res) => {
  const policy = db.prepare('SELECT * FROM policies WHERE id = ?').get(req.params.id);
  if (!policy) return res.status(404).json({ error: 'নথি পাওয়া যায়নি' });

  const filePath = path.join(__dirname, '..', policy.file_path);
  fs.unlink(filePath, () => {}); // best-effort delete

  db.prepare('DELETE FROM policies WHERE id = ?').run(req.params.id);
  res.json({ message: 'নথি মুছে ফেলা হয়েছে' });
});

module.exports = router;
