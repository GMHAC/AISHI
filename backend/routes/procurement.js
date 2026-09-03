// ============================================================
// PROCUREMENT MANAGEMENT
// Supplier Registration/Evaluation -> RFQ/Quotation -> Comparative Statement
// -> Purchase Requisition -> PO -> Approval -> Supplier Performance.
// Covers Fabric / Accessories / General procurement (instruction sections
// 29-32) through one shared structure, differentiated by `category`.
// An approved PO marked 'received' automatically posts a stock receipt
// into Inventory (routes/inventory.js reads the same purchase_orders row).
// ============================================================
const express = require('express');
const db = require('../db');
const { authenticate, requireManagement, requireAdminOrDirector } = require('../middleware/auth');
const { audit } = require('../lib/audit');

const router = express.Router();
router.use(authenticate);

const CATEGORIES = ['fabric', 'accessories', 'general'];
const PR_STATUSES = ['pending', 'approved', 'rejected', 'converted_to_po', 'cancelled'];
const PO_STATUSES = ['draft', 'approved', 'sent', 'partially_received', 'received', 'cancelled'];

// ==================== SUPPLIERS ====================
router.post('/suppliers', requireManagement, (req, res) => {
  const { name, category = 'general', contact_person = null, phone = null, email = null, address = null } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name আবশ্যক' });
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
  const info = db.prepare(`
    INSERT INTO suppliers (name, category, contact_person, phone, email, address)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name.trim(), category, contact_person, phone, email, address);
  res.status(201).json({ supplier: db.prepare('SELECT * FROM suppliers WHERE id = ?').get(info.lastInsertRowid) });
});

router.get('/suppliers', (req, res) => {
  const { category } = req.query;
  let query = 'SELECT * FROM suppliers WHERE is_active = 1';
  const params = [];
  if (category) { query += ' AND category = ?'; params.push(category); }
  res.json({ suppliers: db.prepare(query + ' ORDER BY evaluation_score DESC, name').all(...params) });
});

// Supplier Evaluation / Supplier Performance
router.put('/suppliers/:id/evaluation', requireAdminOrDirector, (req, res) => {
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!supplier) return res.status(404).json({ error: 'Supplier পাওয়া যায়নি' });
  const score = Number(req.body.evaluation_score);
  if (!(score >= 0 && score <= 100)) return res.status(400).json({ error: 'evaluation_score 0-100 এর মধ্যে হতে হবে' });
  db.prepare('UPDATE suppliers SET evaluation_score = ? WHERE id = ?').run(score, req.params.id);
  res.json({ supplier: db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id) });
});

// ==================== PURCHASE REQUISITION ====================
router.post('/requisitions', requireManagement, (req, res) => {
  const { department, category = 'general', item_description, quantity, unit = null, justification = null } = req.body;
  if (!department) return res.status(400).json({ error: 'department আবশ্যক' });
  if (!item_description) return res.status(400).json({ error: 'item_description আবশ্যক' });
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
  const qty = Number(quantity);
  if (!qty || qty <= 0) return res.status(400).json({ error: 'quantity একটি ধনাত্মক সংখ্যা হতে হবে' });

  const info = db.prepare(`
    INSERT INTO purchase_requisitions (department, category, item_description, quantity, unit, justification, requested_by, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(department, category, item_description, qty, unit, justification, req.user.id);

  const requisition = db.prepare('SELECT * FROM purchase_requisitions WHERE id = ?').get(info.lastInsertRowid);
  audit(req, { action: 'PR_CREATE', tableName: 'purchase_requisitions', recordId: requisition.id, newValue: requisition });
  res.status(201).json({ requisition });
});

router.get('/requisitions', (req, res) => {
  const { status, department, category } = req.query;
  let query = 'SELECT * FROM purchase_requisitions WHERE 1=1';
  const params = [];
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (department) { query += ' AND department = ?'; params.push(department); }
  if (category) { query += ' AND category = ?'; params.push(category); }
  query += ' ORDER BY created_at DESC';
  res.json({ requisitions: db.prepare(query).all(...params) });
});

router.put('/requisitions/:id/status', requireAdminOrDirector, (req, res) => {
  const existing = db.prepare('SELECT * FROM purchase_requisitions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Requisition পাওয়া যায়নি' });
  const { status } = req.body;
  if (!PR_STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of: ${PR_STATUSES.join(', ')}` });

  db.prepare(`
    UPDATE purchase_requisitions SET status = ?,
      approved_by = CASE WHEN ? = 'approved' THEN ? ELSE approved_by END,
      approved_at = CASE WHEN ? = 'approved' THEN datetime('now') ELSE approved_at END,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(status, status, req.user.id, status, req.params.id);

  const requisition = db.prepare('SELECT * FROM purchase_requisitions WHERE id = ?').get(req.params.id);
  audit(req, { action: 'PR_STATUS', tableName: 'purchase_requisitions', recordId: requisition.id, oldValue: existing, newValue: requisition });
  res.json({ requisition });
});

// ==================== RFQ / QUOTATION / COMPARATIVE STATEMENT ====================
router.post('/requisitions/:id/quotations', requireManagement, (req, res) => {
  const requisition = db.prepare('SELECT * FROM purchase_requisitions WHERE id = ?').get(req.params.id);
  if (!requisition) return res.status(404).json({ error: 'Requisition পাওয়া যায়নি' });

  const { supplier_id, quoted_unit_price, quoted_delivery_date = null, notes = null } = req.body;
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplier_id);
  if (!supplier) return res.status(400).json({ error: 'সঠিক supplier_id দিন' });
  const price = Number(quoted_unit_price);
  if (!price || price <= 0) return res.status(400).json({ error: 'quoted_unit_price একটি ধনাত্মক সংখ্যা হতে হবে' });

  const info = db.prepare(`
    INSERT INTO quotations (requisition_id, supplier_id, quoted_unit_price, quoted_delivery_date, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.id, supplier_id, price, quoted_delivery_date, notes, req.user.id);

  res.status(201).json({ quotation: db.prepare('SELECT * FROM quotations WHERE id = ?').get(info.lastInsertRowid) });
});

// Comparative Statement — all quotations for a requisition, cheapest first
router.get('/requisitions/:id/quotations', (req, res) => {
  const rows = db.prepare(`
    SELECT q.*, s.name AS supplier_name, s.evaluation_score
    FROM quotations q JOIN suppliers s ON s.id = q.supplier_id
    WHERE q.requisition_id = ? ORDER BY q.quoted_unit_price ASC
  `).all(req.params.id);
  res.json({ comparative_statement: rows });
});

router.put('/quotations/:id/select', requireAdminOrDirector, (req, res) => {
  const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(req.params.id);
  if (!quotation) return res.status(404).json({ error: 'Quotation পাওয়া যায়নি' });
  const markSelected = db.transaction(() => {
    db.prepare('UPDATE quotations SET is_selected = 0 WHERE requisition_id = ?').run(quotation.requisition_id);
    db.prepare('UPDATE quotations SET is_selected = 1 WHERE id = ?').run(req.params.id);
  });
  markSelected();
  res.json({ quotation: db.prepare('SELECT * FROM quotations WHERE id = ?').get(req.params.id) });
});

// ==================== PURCHASE ORDER + APPROVAL ====================
function generatePoNumber() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM purchase_orders').get().n + 1;
  return `PO-${new Date().getFullYear()}-${String(count).padStart(5, '0')}`;
}

router.post('/orders', requireManagement, (req, res) => {
  const { requisition_id = null, supplier_id, category = 'general', item_description, quantity, unit_price, expected_delivery_date = null } = req.body;
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplier_id);
  if (!supplier) return res.status(400).json({ error: 'সঠিক supplier_id দিন' });
  if (!item_description) return res.status(400).json({ error: 'item_description আবশ্যক' });
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
  const qty = Number(quantity), price = Number(unit_price);
  if (!qty || qty <= 0) return res.status(400).json({ error: 'quantity একটি ধনাত্মক সংখ্যা হতে হবে' });
  if (!price || price <= 0) return res.status(400).json({ error: 'unit_price একটি ধনাত্মক সংখ্যা হতে হবে' });

  const poNumber = generatePoNumber();
  const totalAmount = Math.round(qty * price * 100) / 100;

  const createPo = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO purchase_orders (po_number, requisition_id, supplier_id, category, item_description, quantity, unit_price, total_amount, expected_delivery_date, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
    `).run(poNumber, requisition_id, supplier_id, category, item_description, qty, price, totalAmount, expected_delivery_date, req.user.id);
    if (requisition_id) {
      db.prepare(`UPDATE purchase_requisitions SET status = 'converted_to_po', updated_at = datetime('now') WHERE id = ?`).run(requisition_id);
    }
    return info.lastInsertRowid;
  });
  const poId = createPo();

  const order = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(poId);
  audit(req, { action: 'PO_CREATE', tableName: 'purchase_orders', recordId: order.id, newValue: order });
  res.status(201).json({ order });
});

router.get('/orders', (req, res) => {
  const { status, category, supplier_id } = req.query;
  let query = 'SELECT * FROM purchase_orders WHERE 1=1';
  const params = [];
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (category) { query += ' AND category = ?'; params.push(category); }
  if (supplier_id) { query += ' AND supplier_id = ?'; params.push(supplier_id); }
  query += ' ORDER BY created_at DESC';
  res.json({ orders: db.prepare(query).all(...params) });
});

// Approval + status transitions. Setting status to 'received' or 'partially_received' also needs
// warehouse_id + received_quantity so Inventory (routes/inventory.js) can post the stock receipt —
// that posting itself happens via POST /api/inventory/receive-po, kept in inventory.js so all
// stock-balance logic lives in one place.
router.put('/orders/:id/status', requireAdminOrDirector, (req, res) => {
  const existing = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'PO পাওয়া যায়নি' });
  const { status } = req.body;
  if (!PO_STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of: ${PO_STATUSES.join(', ')}` });

  db.prepare(`
    UPDATE purchase_orders SET status = ?,
      approved_by = CASE WHEN ? = 'approved' THEN ? ELSE approved_by END,
      approved_at = CASE WHEN ? = 'approved' THEN datetime('now') ELSE approved_at END,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(status, status, req.user.id, status, req.params.id);

  const order = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.params.id);
  audit(req, { action: 'PO_STATUS', tableName: 'purchase_orders', recordId: order.id, oldValue: existing, newValue: order });
  res.json({ order });
});

module.exports = router;
