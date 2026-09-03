const express = require('express');
const db = require('../db');
const { authenticate, requireAdminOrDirector } = require('../middleware/auth');
const { evaluatePeriod } = require('../lib/kpi');

const router = express.Router();
router.use(authenticate);

const PERIODS = ['daily', 'weekly', 'monthly', 'quarterly', 'half_yearly', 'annual'];

function loadEmployeeOrFail(req, res) {
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.employeeId);
  if (!employee) { res.status(404).json({ error: 'কর্মী পাওয়া যায়নি' }); return null; }
  if (req.user.role === 'employee' && employee.employee_code !== req.user.employee_code) {
    res.status(403).json({ error: 'অনুমতি নেই' }); return null;
  }
  return employee;
}

// ---------- One employee, one period type, one anchor date ----------
// GET /api/kpi/evaluation/:employeeId?period=weekly&date=2026-08-09
router.get('/evaluation/:employeeId', (req, res) => {
  const employee = loadEmployeeOrFail(req, res);
  if (!employee) return;
  const period = req.query.period || 'weekly';
  if (!PERIODS.includes(period)) return res.status(400).json({ error: `period must be one of: ${PERIODS.join(', ')}` });
  const result = evaluatePeriod(db, employee, period, req.query.date);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ employee_id: employee.id, employee_code: employee.employee_code, full_name: employee.full_name, designation: employee.designation, ...result });
});

// ---------- One employee, all six periods at once (full evaluation card) ----------
// GET /api/kpi/evaluation-summary/:employeeId?date=2026-08-09
router.get('/evaluation-summary/:employeeId', (req, res) => {
  const employee = loadEmployeeOrFail(req, res);
  if (!employee) return;
  const date = req.query.date;
  const summary = {};
  for (const p of PERIODS) summary[p] = evaluatePeriod(db, employee, p, date);
  res.json({ employee_id: employee.id, employee_code: employee.employee_code, full_name: employee.full_name, designation: employee.designation, join_date: employee.join_date, periods: summary });
});

// ---------- Admin dashboard: designation-wise weekly performance snapshot ----------
// GET /api/kpi/dashboard?period=weekly&date=...&department=...
router.get('/dashboard', requireAdminOrDirector, (req, res) => {
  const period = req.query.period || 'weekly';
  if (!PERIODS.includes(period)) return res.status(400).json({ error: `period must be one of: ${PERIODS.join(', ')}` });
  const { department = '' } = req.query;

  let query = "SELECT * FROM employees WHERE status = 'Active'";
  const params = [];
  if (department) { query += ' AND department = ?'; params.push(department); }
  const employees = db.prepare(query).all(...params);

  const rows = employees.map((e) => {
    const r = evaluatePeriod(db, e, period, req.query.date);
    return {
      employee_id: e.id, employee_code: e.employee_code, full_name: e.full_name,
      department: e.department, designation: e.designation,
      average_score: r.average_score, days_submitted: r.days_submitted, days_in_period: r.days_in_period,
    };
  });

  const scored = rows.filter((r) => r.average_score !== null);
  const overallAverage = scored.length ? Math.round((scored.reduce((s, r) => s + r.average_score, 0) / scored.length) * 100) / 100 : null;
  const noSubmission = rows.filter((r) => r.average_score === null);
  const belowStandard = scored.filter((r) => r.average_score < 70).sort((a, b) => a.average_score - b.average_score);

  res.json({
    period, total_active: rows.length, submitted: scored.length, not_submitted: noSubmission.length,
    overall_average: overallAverage, below_standard_count: belowStandard.length,
    below_standard: belowStandard, rows,
  });
});

// ---------- Assign / list task templates for a designation (so every employee sharing
//             the same designation automatically gets the same daily checklist) ----------
router.get('/templates/:designation', (req, res) => {
  const items = db.prepare('SELECT * FROM checklist_items WHERE is_active = 1 AND designation = ? ORDER BY id').all(req.params.designation);
  res.json({ designation: req.params.designation, items });
});

module.exports = router;
