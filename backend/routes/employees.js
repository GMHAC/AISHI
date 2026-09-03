const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate, requireAdmin, requireAdminOrDirector } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const DEFAULT_EMPLOYEE_PASSWORD = process.env.DEFAULT_EMPLOYEE_PASSWORD || 'Rizvi@1234';

function cleanStr(val) {
  if (val === undefined || val === null) return null;
  const t = String(val).trim();
  return t === '' ? null : t;
}
function cleanNumber(val) {
  const c = cleanStr(val);
  if (c === null) return null;
  const n = Number(String(c).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}
function cleanInt(val) {
  const n = cleanNumber(val);
  return n === null ? null : Math.round(n);
}
function pick(row, ...keys) {
  for (const k of keys) {
    for (const rowKey of Object.keys(row)) {
      if (rowKey.trim().toLowerCase() === k.toLowerCase()) return row[rowKey];
    }
  }
  return undefined;
}
function readImportRows(buffer, originalName) {
  if (originalName.toLowerCase().endsWith('.csv')) {
    return parse(buffer.toString('utf8'), {
      columns: true, skip_empty_lines: true, relax_column_count: true, bom: true, trim: true,
    });
  }
  const wb = XLSX.read(buffer, { type: 'buffer' });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
}

const EDITABLE_FIELDS = [
  'full_name', 'name_bn', 'join_date', 'department', 'category', 'section', 'sub_section',
  'designation', 'job_location', 'status', 'job_termination_type', 'termination_date',
  'gross_salary', 'phone', 'whatsapp', 'national_id', 'birth_certificate', 'bank_account',
  'bank_account_no', 'routing_number', 'blood_group', 'gender', 'religion', 'job_type',
  'birth_date', 'payment_mode', 'email', 'number_of_child', 'nationality', 'weekend',
  'payroll_type', 'grade', 'job_division', 'shift_name', 'transport_service',
];

// ---------- List employees (search + filters + pagination) ----------
router.get('/', (req, res) => {
  const {
    search = '', department = '', status = '', section = '',
    page = 1, limit = 25,
  } = req.query;

  const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

  let where = ' WHERE 1=1';
  const params = [];

  if (search) {
    where += ' AND (full_name LIKE ? OR employee_code LIKE ? OR designation LIKE ? OR phone LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  if (department) { where += ' AND department = ?'; params.push(department); }
  if (status) { where += ' AND status = ?'; params.push(status); }
  if (section) { where += ' AND section = ?'; params.push(section); }

  const total = db.prepare(`SELECT COUNT(*) AS count FROM employees${where}`).get(...params).count;

  const rows = db.prepare(
    `SELECT * FROM employees${where} ORDER BY employee_code ASC LIMIT ? OFFSET ?`
  ).all(...params, Number(limit), offset);

  res.json({ employees: rows, total, page: Number(page), limit: Number(limit) });
});

// ---------- Department / section summary (for dashboard filters & charts) ----------
router.get('/meta/departments', (req, res) => {
  const rows = db.prepare(
    `SELECT department, COUNT(*) AS count FROM employees WHERE status = 'Active' GROUP BY department ORDER BY count DESC`
  ).all();
  res.json({ departments: rows });
});

// ---------- Bulk CSV/Excel import, optionally scoped to one department (admin customization panel) ----------
// Reuses the same HR export column layout as scripts/import_employees.js.
// If `department` is provided in the form body, only rows whose Department column matches
// (case-insensitive) are imported — everything else in the file is skipped.
router.post('/import', requireAdmin, importUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ফাইল আবশ্যক (file)' });

  const departmentFilter = cleanStr(req.body.department);

  let rows;
  try {
    rows = readImportRows(req.file.buffer, req.file.originalname);
  } catch (e) {
    return res.status(400).json({ error: 'ফাইল পড়া যায়নি: ' + e.message });
  }

  const upsertEmployee = db.prepare(`
    INSERT INTO employees (
      employee_code, punched_id, full_name, name_bn, join_date, department, category,
      section, sub_section, designation, job_location, status, job_termination_type,
      termination_date, gross_salary, phone, whatsapp, national_id, birth_certificate,
      bank_account, bank_account_no, routing_number, blood_group, gender, religion,
      job_type, birth_date, payment_mode, email, number_of_child, nationality, weekend,
      payroll_type, grade, job_division, shift_name, transport_service
    ) VALUES (
      @employee_code, @punched_id, @full_name, @name_bn, @join_date, @department, @category,
      @section, @sub_section, @designation, @job_location, @status, @job_termination_type,
      @termination_date, @gross_salary, @phone, @whatsapp, @national_id, @birth_certificate,
      @bank_account, @bank_account_no, @routing_number, @blood_group, @gender, @religion,
      @job_type, @birth_date, @payment_mode, @email, @number_of_child, @nationality, @weekend,
      @payroll_type, @grade, @job_division, @shift_name, @transport_service
    )
    ON CONFLICT(employee_code) DO UPDATE SET
      punched_id=excluded.punched_id, full_name=excluded.full_name, name_bn=excluded.name_bn,
      join_date=excluded.join_date, department=excluded.department, category=excluded.category,
      section=excluded.section, sub_section=excluded.sub_section, designation=excluded.designation,
      job_location=excluded.job_location, status=excluded.status,
      job_termination_type=excluded.job_termination_type, termination_date=excluded.termination_date,
      gross_salary=excluded.gross_salary, phone=excluded.phone, whatsapp=excluded.whatsapp,
      national_id=excluded.national_id, birth_certificate=excluded.birth_certificate,
      bank_account=excluded.bank_account, bank_account_no=excluded.bank_account_no,
      routing_number=excluded.routing_number, blood_group=excluded.blood_group, gender=excluded.gender,
      religion=excluded.religion, job_type=excluded.job_type, birth_date=excluded.birth_date,
      payment_mode=excluded.payment_mode, email=excluded.email, number_of_child=excluded.number_of_child,
      nationality=excluded.nationality, weekend=excluded.weekend, payroll_type=excluded.payroll_type,
      grade=excluded.grade, job_division=excluded.job_division, shift_name=excluded.shift_name,
      transport_service=excluded.transport_service, updated_at=datetime('now')
  `);

  const findUser = db.prepare('SELECT id FROM users WHERE employee_code = ?');
  const insertUser = db.prepare(`
    INSERT INTO users (employee_code, name, password, role, must_change_password)
    VALUES (?, ?, ?, 'employee', 1)
  `);
  const passwordHash = bcrypt.hashSync(DEFAULT_EMPLOYEE_PASSWORD, 10);

  let imported = 0, skipped = 0, deptSkipped = 0, usersCreated = 0;
  const rejectedSample = [];

  const runAll = db.transaction((allRows) => {
    for (const row of allRows) {
      const employee_code = cleanStr(pick(row, 'Employee Id', 'employee_code', 'EMPLOYEE_CODE'));
      const full_name = cleanStr(pick(row, 'Employee Name', 'full_name', 'FULL_NAME'));
      if (!employee_code || !full_name) {
        skipped++;
        if (rejectedSample.length < 20) rejectedSample.push({ reason: 'Employee Id / Employee Name খালি' });
        continue;
      }

      const rowDept = cleanStr(pick(row, 'Department', 'department', 'DEPARTMENT'));
      if (departmentFilter && (!rowDept || rowDept.toLowerCase() !== departmentFilter.toLowerCase())) {
        deptSkipped++;
        continue;
      }

      upsertEmployee.run({
        employee_code,
        punched_id: cleanStr(pick(row, 'Punched Id')),
        full_name,
        name_bn: cleanStr(pick(row, 'Employee Name 2L')),
        join_date: cleanStr(pick(row, 'Join Date')),
        department: rowDept,
        category: cleanStr(pick(row, 'Category')),
        section: cleanStr(pick(row, 'Section')),
        sub_section: cleanStr(pick(row, 'Sub Section')),
        designation: cleanStr(pick(row, 'Designation')),
        job_location: cleanStr(pick(row, 'Job Location')),
        status: cleanStr(pick(row, 'Status')) || 'Active',
        job_termination_type: cleanStr(pick(row, 'Job Termination Type')),
        termination_date: cleanStr(pick(row, 'Termination Date')),
        gross_salary: cleanNumber(pick(row, 'Gross Salary')),
        phone: cleanStr(pick(row, 'Phone No')),
        whatsapp: cleanStr(pick(row, 'Whatsapp No')),
        national_id: cleanStr(pick(row, 'National Id')),
        birth_certificate: cleanStr(pick(row, 'Birth Certificate')),
        bank_account: cleanStr(pick(row, 'Bank Account')),
        bank_account_no: cleanStr(pick(row, 'Bank Account No')),
        routing_number: cleanStr(pick(row, 'Routing Number')),
        blood_group: cleanStr(pick(row, 'Blood Group')),
        gender: cleanStr(pick(row, 'Gender')),
        religion: cleanStr(pick(row, 'Religion')),
        job_type: cleanStr(pick(row, 'Job Type')),
        birth_date: cleanStr(pick(row, 'Birth Date')),
        payment_mode: cleanStr(pick(row, 'Payment Mode')),
        email: cleanStr(pick(row, 'Email Address')),
        number_of_child: cleanInt(pick(row, 'Number Of Child')),
        nationality: cleanStr(pick(row, 'Nationality')),
        weekend: cleanStr(pick(row, 'Weekend')),
        payroll_type: cleanStr(pick(row, 'Payroll Type')),
        grade: cleanStr(pick(row, 'Grade')),
        job_division: cleanStr(pick(row, 'Job Division')),
        shift_name: cleanStr(pick(row, 'Shift Name')),
        transport_service: cleanStr(pick(row, 'Transport Service')),
      });
      imported++;

      if (!findUser.get(employee_code)) {
        insertUser.run(employee_code, full_name, passwordHash);
        usersCreated++;
      }
    }
  });
  runAll(rows);

  res.json({
    message: `${imported} টি কর্মী রেকর্ড ইমপোর্ট/আপডেট হয়েছে`,
    imported, skipped, department_filter: departmentFilter || null,
    department_mismatch_skipped: deptSkipped, users_created: usersCreated,
    default_password: usersCreated > 0 ? DEFAULT_EMPLOYEE_PASSWORD : undefined,
    rejected_sample: rejectedSample,
  });
});

// ---------- Single employee ----------
router.get('/:id', (req, res) => {
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!employee) return res.status(404).json({ error: 'কর্মী পাওয়া যায়নি' });

  // Non-admins can only view their own record
  if (req.user.role === 'employee' && employee.employee_code !== req.user.employee_code) {
    return res.status(403).json({ error: 'অনুমতি নেই' });
  }

  res.json({ employee });
});

// ---------- Create employee (admin only) ----------
router.post('/', requireAdmin, (req, res) => {
  const { employee_code, full_name } = req.body;
  if (!employee_code || !full_name) {
    return res.status(400).json({ error: 'employee_code এবং full_name আবশ্যক' });
  }

  const cols = ['employee_code', 'full_name', ...EDITABLE_FIELDS.filter((f) => f in req.body)];
  const values = cols.map((c) => (c === 'employee_code' ? employee_code : c === 'full_name' ? full_name : req.body[c]));
  const placeholders = cols.map(() => '?').join(', ');

  try {
    const info = db.prepare(`INSERT INTO employees (${cols.join(', ')}) VALUES (${placeholders})`).run(...values);
    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ employee });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'এই Employee Code ইতিমধ্যে বিদ্যমান' });
    }
    res.status(500).json({ error: 'কর্মী তৈরি করা যায়নি' });
  }
});

// ---------- Update employee (admin only) ----------
router.put('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'কর্মী পাওয়া যায়নি' });

  const updates = [];
  const params = [];
  for (const field of EDITABLE_FIELDS) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'আপডেট করার মতো কোনো তথ্য দেওয়া হয়নি' });

  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);

  db.prepare(`UPDATE employees SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  res.json({ employee });
});

// ---------- Delete employee (admin only) ----------
router.delete('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'কর্মী পাওয়া যায়নি' });

  db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
  res.json({ message: 'কর্মী মুছে ফেলা হয়েছে' });
});

module.exports = router;
