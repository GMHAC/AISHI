const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const db = require('../db');
const { authenticate, requireAdminOrDirector } = require('../middleware/auth');
const { weekStartFor, weekEndFor, weeklySignal } = require('../lib/hours');

const router = express.Router();
router.use(authenticate);

const uploadDir = path.join(__dirname, '..', 'uploads', 'salary');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir, limits: { fileSize: 20 * 1024 * 1024 } });

// Accepted columns (case-insensitive) in the imported CSV/XLSX salary sheet.
// EMPLOYEE_CODE, MONTH (YYYY-MM), BASIC, GROSS_SALARY, OT_HOURS, OT_RATE, OT_AMOUNT, OTHER_ALLOWANCE, DEDUCTIONS, NET_PAYABLE
function readRows(filePath, originalName) {
  const isCsv = originalName.toLowerCase().endsWith('.csv');
  if (isCsv) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return parse(raw, { columns: true, skip_empty_lines: true, trim: true });
  }
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function normKey(obj, ...keys) {
  for (const k of keys) {
    for (const rowKey of Object.keys(obj)) {
      if (rowKey.trim().toUpperCase() === k) return obj[rowKey];
    }
  }
  return undefined;
}

// ---------- Import a monthly salary sheet (admin only) ----------
router.post('/import', requireAdminOrDirector, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ফাইল আবশ্যক (file)' });
  const month = req.body.month; // 'YYYY-MM'
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: "month আবশ্যক, ফরম্যাট 'YYYY-MM' (e.g. 2026-07)" });
  }

  let rows;
  try {
    rows = readRows(req.file.path, req.file.originalname);
  } catch (e) {
    return res.status(400).json({ error: 'ফাইল পড়া যায়নি: ' + e.message });
  }

  const findEmp = db.prepare('SELECT id FROM employees WHERE employee_code = ? OR punched_id = ?');
  const upsert = db.prepare(`
    INSERT INTO salary_master (employee_id, month, basic, gross_salary, ot_hours, ot_rate, ot_amount, other_allowance, deductions, net_payable, source_file, imported_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(employee_id, month) DO UPDATE SET
      basic = excluded.basic, gross_salary = excluded.gross_salary, ot_hours = excluded.ot_hours,
      ot_rate = excluded.ot_rate, ot_amount = excluded.ot_amount, other_allowance = excluded.other_allowance,
      deductions = excluded.deductions, net_payable = excluded.net_payable,
      source_file = excluded.source_file, imported_by = excluded.imported_by
  `);

  let accepted = 0; const rejected = [];
  const run = db.transaction((allRows) => {
    for (const r of allRows) {
      const code = normKey(r, 'EMPLOYEE_CODE', 'EMPLOYEE_ID', 'ID', 'CARD_NO');
      if (!code) { rejected.push({ row: r, reason: 'EMPLOYEE_CODE missing' }); continue; }
      const emp = findEmp.get(String(code).trim(), String(code).trim());
      if (!emp) { rejected.push({ row: r, reason: `Employee ${code} not found in master` }); continue; }

      upsert.run(
        emp.id, month,
        num(normKey(r, 'BASIC')),
        num(normKey(r, 'GROSS_SALARY', 'GROSS')),
        num(normKey(r, 'OT_HOURS')),
        num(normKey(r, 'OT_RATE')),
        num(normKey(r, 'OT_AMOUNT', 'OT_AMT')),
        num(normKey(r, 'OTHER_ALLOWANCE', 'ALLOWANCE')),
        num(normKey(r, 'DEDUCTIONS')),
        num(normKey(r, 'NET_PAYABLE', 'NET')),
        req.file.originalname, req.user.id
      );
      accepted++;
    }
  });
  run(rows);

  res.json({ message: `${accepted} জন কর্মীর সেলারি রেকর্ড সংরক্ষিত হয়েছে`, month, accepted, rejected_count: rejected.length, rejected: rejected.slice(0, 50) });
});

// ---------- Salary history for one employee (self, or admin/director for anyone) ----------
router.get('/employee/:employeeId', (req, res) => {
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.employeeId);
  if (!employee) return res.status(404).json({ error: 'কর্মী পাওয়া যায়নি' });
  if (req.user.role === 'employee' && employee.employee_code !== req.user.employee_code) {
    return res.status(403).json({ error: 'অনুমতি নেই' });
  }
  const rows = db.prepare('SELECT * FROM salary_master WHERE employee_id = ? ORDER BY month DESC').all(employee.id);
  res.json({ employee_id: employee.id, employee_code: employee.employee_code, full_name: employee.full_name, salary: rows });
});

// ---------- Reconciliation: imported salary-sheet OT hours vs attendance-calculated OT (admin) ----------
// GET /api/salary/reconciliation/:month  ('YYYY-MM')
router.get('/reconciliation/:month', requireAdminOrDirector, (req, res) => {
  const month = req.params.month;
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: "month ফরম্যাট 'YYYY-MM'" });

  const rows = db.prepare(`
    SELECT s.employee_id, e.employee_code, e.full_name, e.department,
           s.ot_hours AS salary_ot_hours, s.gross_salary, s.net_payable,
           COALESCE((SELECT SUM(a.ot_hours) FROM attendance a WHERE a.employee_id = s.employee_id AND a.date LIKE ?), 0) AS attendance_ot_hours
    FROM salary_master s JOIN employees e ON e.id = s.employee_id
    WHERE s.month = ?
    ORDER BY e.employee_code
  `).all(month + '%', month);

  const withDiff = rows.map((r) => {
    const diff = Math.round((r.salary_ot_hours - r.attendance_ot_hours) * 100) / 100;
    return { ...r, diff_hours: diff, result: Math.abs(diff) < 0.5 ? 'MATCH' : 'REVIEW' };
  });

  res.json({ month, total: withDiff.length, mismatches: withDiff.filter((r) => r.result === 'REVIEW').length, rows: withDiff });
});

module.exports = router;
