const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const db = require('../db');
const { authenticate, requireAdminOrDirector } = require('../middleware/auth');
const { toIsoDate } = require('../lib/dates');

const router = express.Router();
router.use(authenticate);

const uploadDir = path.join(__dirname, '..', 'uploads', 'training');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir, limits: { fileSize: 25 * 1024 * 1024 } });

const GAP_MONTHS = 6;

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function normKey(obj, ...keys) {
  for (const k of keys) {
    for (const rowKey of Object.keys(obj)) {
      if (rowKey.trim().toUpperCase() === k) return obj[rowKey];
    }
  }
  return undefined;
}
function readRows(filePath, originalName) {
  if (originalName.toLowerCase().endsWith('.csv')) {
    return parse(fs.readFileSync(filePath, 'utf8'), { columns: true, skip_empty_lines: true, trim: true });
  }
  const wb = XLSX.readFile(filePath);
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
}

// ---------- Bulk import a training record sheet (admin) ----------
// Required columns: EMPLOYEE_CODE, TRAINING_NAME, TRAINING_DATE (CATEGORY optional)
router.post('/import', requireAdminOrDirector, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ফাইল আবশ্যক (file)' });
  let rows;
  try { rows = readRows(req.file.path, req.file.originalname); }
  catch (e) { return res.status(400).json({ error: 'ফাইল পড়া যায়নি: ' + e.message }); }

  const findEmp = db.prepare('SELECT id FROM employees WHERE employee_code = ? OR punched_id = ?');
  const insert = db.prepare(`
    INSERT INTO training_records (employee_id, training_name, training_date, category, source_file, imported_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let accepted = 0; const rejected = [];
  const run = db.transaction((allRows) => {
    for (const r of allRows) {
      const code = normKey(r, 'EMPLOYEE_CODE', 'EMPLOYEE_ID', 'ID', 'CARD_NO');
      const trainingName = normKey(r, 'TRAINING_NAME', 'TRAINING');
      const trainingDate = normKey(r, 'TRAINING_DATE', 'DATE');
      if (!code || !trainingName) { rejected.push({ row: r, reason: 'EMPLOYEE_CODE/TRAINING_NAME missing' }); continue; }
      const emp = findEmp.get(String(code).trim(), String(code).trim());
      if (!emp) { rejected.push({ row: r, reason: `Employee ${code} not found in master` }); continue; }
      insert.run(emp.id, String(trainingName).trim(), trainingDate ? String(trainingDate).trim() : null,
        normKey(r, 'CATEGORY') || null, req.file.originalname, req.user.id);
      accepted++;
    }
  });
  run(rows);

  res.json({ message: `${accepted} টি ট্রেনিং রেকর্ড সংরক্ষিত হয়েছে`, accepted, rejected_count: rejected.length, rejected: rejected.slice(0, 50) });
});

// ---------- Add a single training record, optionally with a scanned doc/PDF/image ----------
router.post('/', requireAdminOrDirector, upload.single('evidence'), (req, res) => {
  const { employee_id, training_name, training_date, category } = req.body;
  if (!employee_id || !training_name) return res.status(400).json({ error: 'employee_id ও training_name আবশ্যক' });
  const source_file = req.file ? `/uploads/training/${req.file.filename}` : null;
  const info = db.prepare(`
    INSERT INTO training_records (employee_id, training_name, training_date, category, source_file, imported_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(employee_id, training_name, training_date || null, category || null, source_file, req.user.id);
  res.status(201).json({ record: db.prepare('SELECT * FROM training_records WHERE id = ?').get(info.lastInsertRowid) });
});

// ---------- Training history for one employee ----------
router.get('/employee/:employeeId', (req, res) => {
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.employeeId);
  if (!employee) return res.status(404).json({ error: 'কর্মী পাওয়া যায়নি' });
  if (req.user.role === 'employee' && employee.employee_code !== req.user.employee_code) {
    return res.status(403).json({ error: 'অনুমতি নেই' });
  }
  const rows = db.prepare('SELECT * FROM training_records WHERE employee_id = ? ORDER BY training_date DESC').all(employee.id);
  res.json({ employee_id: employee.id, employee_code: employee.employee_code, full_name: employee.full_name, training: rows });
});

// ---------- Gap dashboard: active employees, joined >= 6 months ago, zero training records ----------
router.get('/gaps', requireAdminOrDirector, (req, res) => {
  const { department = '' } = req.query;
  let query = "SELECT * FROM employees WHERE status = 'Active'";
  const params = [];
  if (department) { query += ' AND department = ?'; params.push(department); }
  const employees = db.prepare(query).all(...params);

  const countStmt = db.prepare('SELECT COUNT(*) AS n FROM training_records WHERE employee_id = ?');
  const today = new Date();
  const cutoff = new Date(today); cutoff.setMonth(cutoff.getMonth() - GAP_MONTHS);
  const cutoffISO = cutoff.toISOString().slice(0, 10);

  const gaps = [];
  let eligibleCount = 0;
  for (const e of employees) {
    const joinISO = toIsoDate(e.join_date);
    if (!joinISO || joinISO > cutoffISO) continue; // not yet 6 months tenure, or unparseable join date -> skip
    eligibleCount++;
    const trained = countStmt.get(e.id).n;
    if (trained === 0) {
      gaps.push({
        employee_id: e.id, employee_code: e.employee_code, full_name: e.full_name,
        department: e.department, designation: e.designation, join_date: joinISO,
        months_tenure: Math.floor((today - new Date(joinISO + 'T00:00:00')) / (1000 * 60 * 60 * 24 * 30.44)),
      });
    }
  }

  res.json({ gap_threshold_months: GAP_MONTHS, eligible_employees: eligibleCount, gap_count: gaps.length, gaps });
});

module.exports = router;
