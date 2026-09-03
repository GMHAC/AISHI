const express = require('express');
const db = require('../db');
const { authenticate, requireAdminOrDirector } = require('../middleware/auth');
const { computeDayHours, weekStartFor, weekEndFor, weeklySignal, WEEKLY_CAP_HOURS } = require('../lib/hours');

const router = express.Router();
router.use(authenticate);

// ---------- Mark / update attendance for one employee on a date (admin/director) ----------
router.post('/', requireAdminOrDirector, (req, res) => {
  const { employee_id, date, status, check_in, check_out, ot_hours, remarks } = req.body;

  if (!employee_id || !date) {
    return res.status(400).json({ error: 'employee_id এবং date আবশ্যক' });
  }

  // Auto-calculate worked/OT hours from check_in/check_out (H:M:S based, minus 1hr break, 8hr general duty).
  // If an explicit ot_hours override is supplied, it wins over the calculated value.
  const calc = computeDayHours(check_in, check_out);
  const finalOt = (ot_hours !== undefined && ot_hours !== null && ot_hours !== '') ? Number(ot_hours) : calc.otHours;

  db.prepare(`
    INSERT INTO attendance (employee_id, date, status, check_in, check_out, ot_hours, worked_hours, remarks, marked_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(employee_id, date) DO UPDATE SET
      status = excluded.status,
      check_in = excluded.check_in,
      check_out = excluded.check_out,
      ot_hours = excluded.ot_hours,
      worked_hours = excluded.worked_hours,
      remarks = excluded.remarks,
      marked_by = excluded.marked_by
  `).run(employee_id, date, status || 'present', check_in || null, check_out || null, finalOt, calc.workedHours, remarks || null, req.user.id);

  const record = db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?').get(employee_id, date);
  res.status(201).json({ attendance: record });
});

// ---------- Bulk mark attendance (e.g. entire floor / department for a date) ----------
router.post('/bulk', requireAdminOrDirector, (req, res) => {
  const { date, records } = req.body; // records: [{ employee_id, status, check_in, check_out, ot_hours }]
  if (!date || !Array.isArray(records)) {
    return res.status(400).json({ error: 'date এবং records[] আবশ্যক' });
  }

  const stmt = db.prepare(`
    INSERT INTO attendance (employee_id, date, status, check_in, check_out, ot_hours, worked_hours, marked_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(employee_id, date) DO UPDATE SET
      status = excluded.status, check_in = excluded.check_in,
      check_out = excluded.check_out, ot_hours = excluded.ot_hours,
      worked_hours = excluded.worked_hours, marked_by = excluded.marked_by
  `);

  const insertMany = db.transaction((rows) => {
    for (const r of rows) {
      const calc = computeDayHours(r.check_in, r.check_out);
      const finalOt = (r.ot_hours !== undefined && r.ot_hours !== null && r.ot_hours !== '') ? Number(r.ot_hours) : calc.otHours;
      stmt.run(r.employee_id, date, r.status || 'present', r.check_in || null, r.check_out || null, finalOt, calc.workedHours, req.user.id);
    }
  });

  insertMany(records);
  res.json({ message: `${records.length} জন কর্মীর উপস্থিতি সংরক্ষিত হয়েছে`, count: records.length });
});

// ---------- Self-service GPS punch in/out (any logged-in employee, for themselves) ----------
// body: { type: 'in'|'out', lat, lng, accuracy, date, time, offline }
//   date/time: the device's local YYYY-MM-DD / HH:MM:SS at the moment of the punch (sent by the
//   client so a punch made offline and synced later still records the real punch moment, not
//   the sync moment). Falls back to server time if not supplied.
//   offline: true if this punch was queued on the device and is being synced after the fact.
// Phone-number/GSM-based location lookup is not possible without a telecom operator API — this
// uses the device's own GPS instead, which is why lat/lng come from the client.
router.post('/punch', (req, res) => {
  const employee = db.prepare('SELECT * FROM employees WHERE employee_code = ?').get(req.user.employee_code);
  if (!employee) return res.status(404).json({ error: 'কর্মী রেকর্ড পাওয়া যায়নি' });

  const { type, lat, lng, accuracy, offline } = req.body;
  if (!['in', 'out'].includes(type)) return res.status(400).json({ error: "type অবশ্যই 'in' অথবা 'out' হতে হবে" });
  if (lat === undefined || lng === undefined || lat === null || lng === null) {
    return res.status(400).json({ error: 'GPS lat/lng আবশ্যক' });
  }

  const now = new Date();
  const date = (req.body.date && /^\d{4}-\d{2}-\d{2}$/.test(req.body.date)) ? req.body.date : now.toISOString().slice(0, 10);
  const time = (req.body.time && /^\d{1,2}:\d{2}(:\d{2})?$/.test(req.body.time)) ? req.body.time : now.toTimeString().slice(0, 8);

  const existing = db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?').get(employee.id, date);

  if (type === 'in') {
    if (existing && existing.check_in) {
      return res.status(409).json({ error: 'আজকের জন্য ইতিমধ্যে ইন পাঞ্চ করা হয়েছে', attendance: existing });
    }
    db.prepare(`
      INSERT INTO attendance (employee_id, date, status, check_in, check_in_lat, check_in_lng, check_in_accuracy, check_in_source, punched_offline, marked_by)
      VALUES (?, ?, 'present', ?, ?, ?, ?, 'gps', ?, NULL)
      ON CONFLICT(employee_id, date) DO UPDATE SET
        status = 'present', check_in = excluded.check_in,
        check_in_lat = excluded.check_in_lat, check_in_lng = excluded.check_in_lng,
        check_in_accuracy = excluded.check_in_accuracy, check_in_source = 'gps',
        punched_offline = excluded.punched_offline
    `).run(employee.id, date, time, lat, lng, accuracy || null, offline ? 1 : 0);
  } else {
    if (!existing || !existing.check_in) {
      return res.status(400).json({ error: 'আউট পাঞ্চের আগে ইন পাঞ্চ করা প্রয়োজন' });
    }
    if (existing.check_out) {
      return res.status(409).json({ error: 'আজকের জন্য ইতিমধ্যে আউট পাঞ্চ করা হয়েছে', attendance: existing });
    }
    const calc = computeDayHours(existing.check_in, time);
    db.prepare(`
      UPDATE attendance SET
        check_out = ?, check_out_lat = ?, check_out_lng = ?, check_out_accuracy = ?, check_out_source = 'gps',
        ot_hours = ?, worked_hours = ?, punched_offline = ?
      WHERE employee_id = ? AND date = ?
    `).run(time, lat, lng, accuracy || null, calc.otHours, calc.workedHours, offline ? 1 : (existing.punched_offline || 0), employee.id, date);
  }

  const record = db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?').get(employee.id, date);
  res.status(201).json({ attendance: record });
});

// ---------- Today's punch status for the logged-in employee (drives the Punch In/Out button) ----------
router.get('/punch-status/today', (req, res) => {
  const employee = db.prepare('SELECT * FROM employees WHERE employee_code = ?').get(req.user.employee_code);
  if (!employee) return res.status(404).json({ error: 'কর্মী রেকর্ড পাওয়া যায়নি' });

  const date = new Date().toISOString().slice(0, 10);
  const record = db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?').get(employee.id, date);
  res.json({
    date,
    punched_in: !!(record && record.check_in),
    punched_out: !!(record && record.check_out),
    attendance: record || null,
  });
});

// ---------- Weekly hours + 72hr signal for one employee ----------
// GET /api/attendance/weekly/:employeeId?date=YYYY-MM-DD  (any date inside the target week)
router.get('/weekly/:employeeId', (req, res) => {
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.employeeId);
  if (!employee) return res.status(404).json({ error: 'কর্মী পাওয়া যায়নি' });
  if (req.user.role === 'employee' && employee.employee_code !== req.user.employee_code) {
    return res.status(403).json({ error: 'অনুমতি নেই' });
  }

  const anchor = req.query.date || new Date().toISOString().slice(0, 10);
  const weekStart = weekStartFor(anchor);
  const weekEnd = weekEndFor(weekStart);

  const days = db.prepare(`
    SELECT date, status, check_in, check_out, ot_hours, worked_hours
    FROM attendance WHERE employee_id = ? AND date BETWEEN ? AND ? ORDER BY date
  `).all(employee.id, weekStart, weekEnd);

  const totalHours = Math.round(days.reduce((sum, d) => sum + (d.worked_hours || 0), 0) * 100) / 100;
  const totalOt = Math.round(days.reduce((sum, d) => sum + (d.ot_hours || 0), 0) * 100) / 100;

  res.json({
    employee_id: employee.id, employee_code: employee.employee_code, full_name: employee.full_name,
    week_start: weekStart, week_end: weekEnd, weekly_cap_hours: WEEKLY_CAP_HOURS,
    total_hours: totalHours, total_ot_hours: totalOt,
    signal: weeklySignal(totalHours), days,
  });
});

// ---------- Admin dashboard: weekly signal counts across all active employees ----------
// GET /api/attendance/weekly-signals?date=YYYY-MM-DD
router.get('/weekly-signals', requireAdminOrDirector, (req, res) => {
  const anchor = req.query.date || new Date().toISOString().slice(0, 10);
  const weekStart = weekStartFor(anchor);
  const weekEnd = weekEndFor(weekStart);

  const rows = db.prepare(`
    SELECT e.id AS employee_id, e.employee_code, e.full_name, e.department,
           COALESCE(SUM(a.worked_hours), 0) AS total_hours
    FROM employees e
    LEFT JOIN attendance a ON a.employee_id = e.id AND a.date BETWEEN ? AND ?
    WHERE e.status = 'Active'
    GROUP BY e.id
  `).all(weekStart, weekEnd);

  const withSignal = rows.map((r) => ({ ...r, total_hours: Math.round(r.total_hours * 100) / 100, signal: weeklySignal(r.total_hours) }));
  const counts = { green: 0, yellow: 0, red: 0 };
  withSignal.forEach((r) => { counts[r.signal]++; });

  res.json({
    week_start: weekStart, week_end: weekEnd, weekly_cap_hours: WEEKLY_CAP_HOURS,
    counts, red_list: withSignal.filter((r) => r.signal === 'red'),
    yellow_list: withSignal.filter((r) => r.signal === 'yellow'),
  });
});

// ---------- Attendance history for one employee ----------
router.get('/employee/:employeeId', (req, res) => {
  const { from, to } = req.query;

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.employeeId);
  if (!employee) return res.status(404).json({ error: 'কর্মী পাওয়া যায়নি' });
  if (req.user.role === 'employee' && employee.employee_code !== req.user.employee_code) {
    return res.status(403).json({ error: 'অনুমতি নেই' });
  }

  let query = 'SELECT * FROM attendance WHERE employee_id = ?';
  const params = [req.params.employeeId];
  if (from) { query += ' AND date >= ?'; params.push(from); }
  if (to) { query += ' AND date <= ?'; params.push(to); }
  query += ' ORDER BY date DESC';

  res.json({ attendance: db.prepare(query).all(...params) });
});

// ---------- Daily summary across all employees (for dashboard) ----------
router.get('/summary/:date', (req, res) => {
  const date = req.params.date;
  const totalActive = db.prepare("SELECT COUNT(*) AS c FROM employees WHERE status = 'Active'").get().c;
  const rows = db.prepare('SELECT status, COUNT(*) AS c FROM attendance WHERE date = ? GROUP BY status').all(date);

  const summary = { present: 0, absent: 0, leave: 0, holiday: 0 };
  rows.forEach((r) => { summary[r.status] = r.c; });
  const marked = rows.reduce((a, r) => a + r.c, 0);

  res.json({ date, total_active_employees: totalActive, marked, not_marked: totalActive - marked, ...summary });
});

module.exports = router;
