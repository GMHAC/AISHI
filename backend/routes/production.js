// ============================================================
// PRODUCTION MANAGEMENT + IE & PERFORMANCE + PLANNING
// Production Order -> Line Plan -> Daily/Hourly Production -> Target vs
// Achievement -> Efficiency/DHU/Rejection/Alter/Rework/WIP.
// Planning cycle Annual->Monthly->Weekly->Daily->Hourly:
// Plan -> Actual -> Achievement -> Failure -> Reason -> Adjustment ->
// Re-plan -> Revised Target.
// ============================================================
const express = require('express');
const db = require('../db');
const { authenticate, requireManagement, requireScopeAccess } = require('../middleware/auth');
const { audit } = require('../lib/audit');

const router = express.Router();
router.use(authenticate);

const ORDER_STATUSES = ['planning', 'in_production', 'completed', 'shipped', 'cancelled'];
const PLAN_TYPES = ['annual', 'monthly', 'weekly', 'daily', 'hourly'];

// ==================== PRODUCTION LINES ====================
router.post('/lines', requireManagement, requireScopeAccess((req) => req.body.department, () => null), (req, res) => {
  const { line_name, department, section = null, capacity_per_hour = null, manpower_count = null } = req.body;
  if (!line_name || !department) return res.status(400).json({ error: 'line_name এবং department আবশ্যক' });
  const info = db.prepare(`
    INSERT INTO production_lines (line_name, department, section, capacity_per_hour, manpower_count)
    VALUES (?, ?, ?, ?, ?)
  `).run(line_name, department, section, capacity_per_hour, manpower_count);
  res.status(201).json({ line: db.prepare('SELECT * FROM production_lines WHERE id = ?').get(info.lastInsertRowid) });
});

router.get('/lines', (req, res) => {
  const { department } = req.query;
  let query = 'SELECT * FROM production_lines WHERE is_active = 1';
  const params = [];
  if (department) { query += ' AND department = ?'; params.push(department); }
  res.json({ lines: db.prepare(query + ' ORDER BY line_name').all(...params) });
});

// ==================== SMV / IE ====================
router.post('/smv', requireManagement, (req, res) => {
  const { style, operation_name, smv_minutes } = req.body;
  if (!style || !operation_name) return res.status(400).json({ error: 'style এবং operation_name আবশ্যক' });
  const smv = Number(smv_minutes);
  if (!smv || smv <= 0) return res.status(400).json({ error: 'smv_minutes একটি ধনাত্মক সংখ্যা হতে হবে' });
  const targetPerHour = Math.round((60 / smv) * 100) / 100;
  const info = db.prepare(`
    INSERT INTO smv_records (style, operation_name, smv_minutes, target_pcs_per_hour, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(style, operation_name, smv, targetPerHour, req.user.id);
  res.status(201).json({ smv: db.prepare('SELECT * FROM smv_records WHERE id = ?').get(info.lastInsertRowid) });
});

router.get('/smv', (req, res) => {
  const { style } = req.query;
  const rows = style
    ? db.prepare('SELECT * FROM smv_records WHERE style = ? ORDER BY id DESC').all(style)
    : db.prepare('SELECT * FROM smv_records ORDER BY id DESC LIMIT 500').all();
  res.json({ smv_records: rows });
});

// ==================== PRODUCTION ORDERS ====================
router.post('/orders', requireManagement, requireScopeAccess((req) => req.body.department, () => null), (req, res) => {
  const { style, buyer = null, po_number = null, order_quantity, department, line_id = null, planned_start_date = null, planned_end_date = null } = req.body;
  if (!style) return res.status(400).json({ error: 'style আবশ্যক' });
  if (!department) return res.status(400).json({ error: 'department আবশ্যক' });
  const qty = Number(order_quantity);
  if (!Number.isInteger(qty) || qty < 1) return res.status(400).json({ error: 'order_quantity একটি ধনাত্মক পূর্ণসংখ্যা হতে হবে' });

  const info = db.prepare(`
    INSERT INTO production_orders (style, buyer, po_number, order_quantity, department, line_id, planned_start_date, planned_end_date, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'planning', ?)
  `).run(style, buyer, po_number, qty, department, line_id, planned_start_date, planned_end_date, req.user.id);

  const order = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(info.lastInsertRowid);
  audit(req, { action: 'PRODUCTION_ORDER_CREATE', tableName: 'production_orders', recordId: order.id, newValue: order });
  res.status(201).json({ order });
});

router.get('/orders', (req, res) => {
  const { status, department, buyer } = req.query;
  let query = 'SELECT * FROM production_orders WHERE 1=1';
  const params = [];
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (department) { query += ' AND department = ?'; params.push(department); }
  if (buyer) { query += ' AND buyer = ?'; params.push(buyer); }
  query += ' ORDER BY created_at DESC';
  res.json({ orders: db.prepare(query).all(...params) });
});

router.put('/orders/:id/status', requireManagement, (req, res) => {
  const existing = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Order পাওয়া যায়নি' });
  const { status } = req.body;
  if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of: ${ORDER_STATUSES.join(', ')}` });
  db.prepare(`UPDATE production_orders SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, req.params.id);
  const order = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(req.params.id);
  audit(req, { action: 'PRODUCTION_ORDER_STATUS', tableName: 'production_orders', recordId: order.id, oldValue: existing, newValue: order });
  res.json({ order });
});

// ==================== PLANNING: Plan -> Actual -> Achievement -> Failure -> Reason -> Re-plan ====================
router.post('/orders/:orderId/plans', requireManagement, (req, res) => {
  const order = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Production order পাওয়া যায়নি' });

  const { plan_type, plan_date, planned_qty } = req.body;
  if (!PLAN_TYPES.includes(plan_type)) return res.status(400).json({ error: `plan_type must be one of: ${PLAN_TYPES.join(', ')}` });
  if (!plan_date) return res.status(400).json({ error: 'plan_date আবশ্যক' });
  const qty = Number(planned_qty);
  if (!Number.isInteger(qty) || qty < 0) return res.status(400).json({ error: 'planned_qty একটি অ-ঋণাত্মক পূর্ণসংখ্যা হতে হবে' });

  const info = db.prepare(`
    INSERT INTO production_plans (production_order_id, plan_type, plan_date, planned_qty, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.orderId, plan_type, plan_date, qty, req.user.id);

  const plan = db.prepare('SELECT * FROM production_plans WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ plan });
});

router.get('/orders/:orderId/plans', (req, res) => {
  const { plan_type } = req.query;
  let query = 'SELECT * FROM production_plans WHERE production_order_id = ?';
  const params = [req.params.orderId];
  if (plan_type) { query += ' AND plan_type = ?'; params.push(plan_type); }
  query += ' ORDER BY plan_date DESC';
  res.json({ plans: db.prepare(query).all(...params) });
});

// Close a plan period: report actual_qty (auto-computes achievement %); if it fell short,
// capture failure_reason/recovery_plan/revised_target — the instruction's
// "Failure -> Reason -> Adjustment -> Re-plan -> Revised Target" chain.
router.put('/plans/:id/actual', requireManagement, (req, res) => {
  const existing = db.prepare('SELECT * FROM production_plans WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Plan পাওয়া যায়নি' });

  const { actual_qty, failure_reason = null, recovery_plan = null, revised_target = null } = req.body;
  const qty = Number(actual_qty);
  if (!Number.isInteger(qty) || qty < 0) return res.status(400).json({ error: 'actual_qty একটি অ-ঋণাত্মক পূর্ণসংখ্যা হতে হবে' });

  const achievementPct = existing.planned_qty > 0 ? Math.round((qty / existing.planned_qty) * 10000) / 100 : null;

  db.prepare(`
    UPDATE production_plans SET actual_qty = ?, achievement_pct = ?, failure_reason = ?, recovery_plan = ?, revised_target = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(qty, achievementPct, failure_reason, recovery_plan, revised_target, req.params.id);

  const plan = db.prepare('SELECT * FROM production_plans WHERE id = ?').get(req.params.id);
  audit(req, { action: 'PRODUCTION_PLAN_ACTUAL', tableName: 'production_plans', recordId: plan.id, oldValue: existing, newValue: plan });
  res.json({ plan });
});

// ==================== DAILY / HOURLY PRODUCTION TRACKING ====================
router.post('/reports', requireManagement, (req, res) => {
  const { production_order_id, line_id = null, report_date, report_hour = null, target_qty = 0, achieved_qty = 0, dhu = null, rejection_qty = 0, alter_qty = 0, rework_qty = 0, wip_qty = 0, manpower_present = null } = req.body;

  const order = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(production_order_id);
  if (!order) return res.status(404).json({ error: 'Production order পাওয়া যায়নি' });
  if (!report_date) return res.status(400).json({ error: 'report_date আবশ্যক' });
  if (report_hour !== null && (report_hour < 0 || report_hour > 23)) return res.status(400).json({ error: 'report_hour 0-23 এর মধ্যে হতে হবে' });

  const efficiencyPct = target_qty > 0 ? Math.round((achieved_qty / target_qty) * 10000) / 100 : null;

  const info = db.prepare(`
    INSERT INTO daily_production_reports (production_order_id, line_id, report_date, report_hour, target_qty, achieved_qty, dhu, rejection_qty, alter_qty, rework_qty, wip_qty, manpower_present, efficiency_pct, reported_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(production_order_id, line_id, report_date, report_hour, target_qty, achieved_qty, dhu, rejection_qty, alter_qty, rework_qty, wip_qty, manpower_present, efficiencyPct, req.user.id);

  const report = db.prepare('SELECT * FROM daily_production_reports WHERE id = ?').get(info.lastInsertRowid);
  audit(req, { action: 'PRODUCTION_REPORT_CREATE', tableName: 'daily_production_reports', recordId: report.id, newValue: report });
  res.status(201).json({ report });
});

router.get('/reports', (req, res) => {
  const { production_order_id, line_id, from_date, to_date } = req.query;
  let query = 'SELECT * FROM daily_production_reports WHERE 1=1';
  const params = [];
  if (production_order_id) { query += ' AND production_order_id = ?'; params.push(production_order_id); }
  if (line_id) { query += ' AND line_id = ?'; params.push(line_id); }
  if (from_date) { query += ' AND report_date >= ?'; params.push(from_date); }
  if (to_date) { query += ' AND report_date <= ?'; params.push(to_date); }
  query += ' ORDER BY report_date DESC, report_hour DESC';
  res.json({ reports: db.prepare(query).all(...params) });
});

// ==================== PERFORMANCE DASHBOARD: Line / Section / Department efficiency, DHU, rejection trend ====================
router.get('/dashboard', (req, res) => {
  const { department, from_date, to_date } = req.query;

  const dprFilters = [];
  const dprParams = [];
  if (from_date) { dprFilters.push('dpr.report_date >= ?'); dprParams.push(from_date); }
  if (to_date) { dprFilters.push('dpr.report_date <= ?'); dprParams.push(to_date); }

  const byLineFilters = [...dprFilters];
  const byLineParams = [...dprParams];
  if (department) { byLineFilters.push('po.department = ?'); byLineParams.push(department); }
  const byLineWhere = byLineFilters.length ? `WHERE ${byLineFilters.join(' AND ')}` : '';

  const byLine = db.prepare(`
    SELECT pl.id AS line_id, pl.line_name, pl.department,
      SUM(dpr.achieved_qty) AS total_achieved, SUM(dpr.target_qty) AS total_target,
      ROUND(AVG(dpr.efficiency_pct), 2) AS avg_efficiency,
      ROUND(AVG(dpr.dhu), 2) AS avg_dhu,
      SUM(dpr.rejection_qty) AS total_rejection
    FROM daily_production_reports dpr
    JOIN production_lines pl ON pl.id = dpr.line_id
    JOIN production_orders po ON po.id = dpr.production_order_id
    ${byLineWhere}
    GROUP BY pl.id ORDER BY avg_efficiency DESC
  `).all(...byLineParams);

  const byDeptWhere = dprFilters.length ? `WHERE ${dprFilters.join(' AND ')}` : '';
  const byDepartment = db.prepare(`
    SELECT po.department,
      SUM(dpr.achieved_qty) AS total_achieved, SUM(dpr.target_qty) AS total_target,
      ROUND(AVG(dpr.efficiency_pct), 2) AS avg_efficiency,
      ROUND(AVG(dpr.dhu), 2) AS avg_dhu
    FROM daily_production_reports dpr
    JOIN production_orders po ON po.id = dpr.production_order_id
    ${byDeptWhere}
    GROUP BY po.department ORDER BY avg_efficiency DESC
  `).all(...dprParams);

  const plansAtRisk = db.prepare(`
    SELECT pp.*, po.style, po.department FROM production_plans pp
    JOIN production_orders po ON po.id = pp.production_order_id
    WHERE pp.actual_qty IS NOT NULL AND pp.achievement_pct < 90
    ORDER BY pp.plan_date DESC LIMIT 50
  `).all();

  res.json({ by_line: byLine, by_department: byDepartment, plans_below_90pct_achievement: plansAtRisk });
});

module.exports = router;
