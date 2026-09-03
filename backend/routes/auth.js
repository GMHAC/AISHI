const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

function issueToken(user) {
  return jwt.sign(
    { id: user.id, employee_code: user.employee_code, role: user.role, name: user.name, scope_type: user.scope_type || null, scope_value: user.scope_value || null },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// ---------- Login (admin / director / department_admin / section_admin) ----------
// Password-based login. Plain 'employee' accounts have no password — they use
// POST /api/auth/employee-login instead.
router.post('/login', (req, res) => {
  const { employee_code, password } = req.body;

  if (!employee_code || !password) {
    return res.status(400).json({ error: 'employee_code এবং password আবশ্যক' });
  }

  const user = db.prepare('SELECT * FROM users WHERE employee_code = ?').get(employee_code.trim());

  if (!user || !user.is_active || !user.password) {
    return res.status(401).json({ error: 'ভুল আইডি অথবা পাসওয়ার্ড' });
  }

  const ok = bcrypt.compareSync(password, user.password);
  if (!ok) {
    return res.status(401).json({ error: 'ভুল আইডি অথবা পাসওয়ার্ড' });
  }

  db.prepare('UPDATE users SET last_login_at = datetime(\'now\') WHERE id = ?').run(user.id);

  const employee = db.prepare('SELECT * FROM employees WHERE employee_code = ?').get(user.employee_code);

  res.json({
    token: issueToken(user),
    user: {
      id: user.id,
      employee_code: user.employee_code,
      name: user.name,
      role: user.role,
      scope_type: user.scope_type,
      scope_value: user.scope_value,
      must_change_password: !!user.must_change_password,
    },
    employee: employee || null,
  });
});

// ---------- Passwordless employee self-service login ----------
// Instruction: "USER LOGIN: Official ID Card Number or মোবাইল নাম্বার। যদি সেই নাম্বার
// সফটওয়্যারে মাস্টার ইমপ্লয় ডাটা শীটে থাকে ... Password: N/A"
// Any employee already present (and Active) in the master employee sheet can log in with
// just their employee_code, phone, or whatsapp number — no password, no pre-created account.
// A plain 'employee'-role user row is auto-provisioned on first use (idempotent).
router.post('/employee-login', (req, res) => {
  const { identifier } = req.body;
  if (!identifier || !identifier.trim()) {
    return res.status(400).json({ error: 'Official ID Card Number অথবা মোবাইল নাম্বার আবশ্যক' });
  }
  const id = identifier.trim();

  const employee = db.prepare(`
    SELECT * FROM employees WHERE status = 'Active' AND (employee_code = ? OR phone = ? OR whatsapp = ?)
  `).get(id, id, id);

  if (!employee) {
    return res.status(401).json({ error: 'এই আইডি/মোবাইল নাম্বার মাস্টার ইমপ্লয় ডাটাবেসে পাওয়া যায়নি' });
  }

  let user = db.prepare('SELECT * FROM users WHERE employee_code = ?').get(employee.employee_code);
  if (!user) {
    // Auto-provision a plain employee account the first time this person logs in.
    // Always role='employee' — this endpoint can never grant admin/director/scoped-admin access,
    // regardless of what identifier was matched.
    const info = db.prepare(`
      INSERT INTO users (employee_code, name, password, role, must_change_password, is_active)
      VALUES (?, ?, NULL, 'employee', 0, 1)
    `).run(employee.employee_code, employee.full_name);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  } else if (user.role !== 'employee' || !user.is_active) {
    // An admin/director/scoped-admin account, or a deactivated account, must not be reachable
    // through the passwordless path even if the identifier happens to match.
    return res.status(401).json({ error: 'এই আইডি দিয়ে পাসওয়ার্ডবিহীন লগইন করা যাবে না' });
  }

  db.prepare('UPDATE users SET last_login_at = datetime(\'now\') WHERE id = ?').run(user.id);

  res.json({
    token: issueToken(user),
    user: { id: user.id, employee_code: user.employee_code, name: user.name, role: user.role },
    employee,
  });
});

// ---------- Current logged-in user ----------
router.get('/me', authenticate, (req, res) => {
  const user = db
    .prepare('SELECT id, employee_code, name, role, scope_type, scope_value, must_change_password, last_login_at FROM users WHERE id = ?')
    .get(req.user.id);

  if (!user) return res.status(404).json({ error: 'User not found' });

  const employee = db.prepare('SELECT * FROM employees WHERE employee_code = ?').get(user.employee_code);
  res.json({ user, employee: employee || null });
});

// ---------- Change password ----------
router.post('/change-password', authenticate, (req, res) => {
  const { current_password, new_password } = req.body;

  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'employee' && !user.password) {
    return res.status(400).json({ error: 'পাসওয়ার্ডবিহীন employee অ্যাকাউন্টে পাসওয়ার্ড পরিবর্তনের প্রয়োজন নেই' });
  }

  // Skip current-password check only on forced first-login change
  if (!user.must_change_password) {
    if (!current_password || !bcrypt.compareSync(current_password, user.password)) {
      return res.status(401).json({ error: 'বর্তমান পাসওয়ার্ড ভুল' });
    }
  }

  const hashed = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?').run(hashed, user.id);

  res.json({ message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে' });
});

module.exports = router;
