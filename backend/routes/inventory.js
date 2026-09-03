// ============================================================
// INVENTORY & STORE MANAGEMENT
// Item Master -> Receive/Issue/Return/Transfer -> Stock Count/Reconciliation
// -> Aging / Dead Stock / Reorder. Current balance is always derived from
// summing stock_transactions (never stored redundantly), so it can't drift.
// ============================================================
const express = require('express');
const db = require('../db');
const { authenticate, requireManagement, requireAdminOrDirector } = require('../middleware/auth');
const { audit } = require('../lib/audit');

const router = express.Router();
router.use(authenticate);

const CATEGORIES = ['fabric', 'accessories', 'general'];
const OUT_TYPES = ['issue', 'transfer_out'];
const ALL_TYPES = ['receive', 'issue', 'return', 'transfer_in', 'transfer_out', 'adjustment'];

// ==================== WAREHOUSES ====================
router.post('/warehouses', requireAdminOrDirector, (req, res) => {
  const { name, type = 'general', location = null } = req.body;
  if (!name) return res.status(400).json({ error: 'name আবশ্যক' });
  const info = db.prepare('INSERT INTO warehouses (name, type, location) VALUES (?, ?, ?)').run(name, type, location);
  res.status(201).json({ warehouse: db.prepare('SELECT * FROM warehouses WHERE id = ?').get(info.lastInsertRowid) });
});
router.get('/warehouses', (req, res) => res.json({ warehouses: db.prepare('SELECT * FROM warehouses WHERE is_active = 1 ORDER BY name').all() }));

// ==================== ITEM MASTER ====================
router.post('/items', requireManagement, (req, res) => {
  const { item_code, item_name, category = 'general', unit = 'pcs', barcode = null, reorder_level = 0 } = req.body;
  if (!item_code || !item_name) return res.status(400).json({ error: 'item_code এবং item_name আবশ্যক' });
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
  if (db.prepare('SELECT id FROM inventory_items WHERE item_code = ?').get(item_code)) {
    return res.status(409).json({ error: 'এই item_code ইতিমধ্যে বিদ্যমান' });
  }
  const info = db.prepare(`
    INSERT INTO inventory_items (item_code, item_name, category, unit, barcode, reorder_level)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(item_code, item_name, category, unit, barcode, Number(reorder_level) || 0);
  res.status(201).json({ item: db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(info.lastInsertRowid) });
});

router.get('/items', (req, res) => {
  const { category, below_reorder } = req.query;
  let query = `
    SELECT i.*, COALESCE(SUM(
      CASE WHEN t.transaction_type IN ('receive','return','transfer_in') THEN t.quantity
           WHEN t.transaction_type IN ('issue','transfer_out') THEN -t.quantity
           WHEN t.transaction_type = 'adjustment' THEN t.quantity
           ELSE 0 END
    ), 0) AS current_stock
    FROM inventory_items i LEFT JOIN stock_transactions t ON t.item_id = i.id
    WHERE i.is_active = 1
  `;
  const params = [];
  if (category) { query += ' AND i.category = ?'; params.push(category); }
  query += ' GROUP BY i.id';
  if (below_reorder === '1') query += ' HAVING current_stock <= i.reorder_level';
  query += ' ORDER BY i.item_name';
  res.json({ items: db.prepare(query).all(...params) });
});

// ==================== STOCK TRANSACTIONS: Receive / Issue / Return / Transfer / Adjustment ====================
router.post('/transactions', requireManagement, (req, res) => {
  const { item_id, warehouse_id, transaction_type, quantity, reference = null, po_id = null, department = null } = req.body;
  if (!ALL_TYPES.includes(transaction_type)) return res.status(400).json({ error: `transaction_type must be one of: ${ALL_TYPES.join(', ')}` });
  const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(item_id);
  if (!item) return res.status(400).json({ error: 'সঠিক item_id দিন' });
  const warehouse = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(warehouse_id);
  if (!warehouse) return res.status(400).json({ error: 'সঠিক warehouse_id দিন' });
  const qty = Number(quantity);
  if (!qty) return res.status(400).json({ error: 'quantity আবশ্যক (adjustment-এর জন্য ঋণাত্মকও গ্রহণযোগ্য)' });

  // For an 'issue' transaction, refuse to take stock negative — a real store control, not just bookkeeping.
  if (OUT_TYPES.includes(transaction_type)) {
    const current = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN transaction_type IN ('receive','return','transfer_in') THEN quantity
                                WHEN transaction_type IN ('issue','transfer_out') THEN -quantity
                                WHEN transaction_type = 'adjustment' THEN quantity ELSE 0 END), 0) AS stock
      FROM stock_transactions WHERE item_id = ? AND warehouse_id = ?
    `).get(item_id, warehouse_id).stock;
    if (Math.abs(qty) > current) {
      return res.status(400).json({ error: `পর্যাপ্ত স্টক নেই — বর্তমান স্টক ${current} ${item.unit}, চাওয়া হয়েছে ${Math.abs(qty)}` });
    }
  }

  const storedQty = transaction_type === 'adjustment' ? qty : Math.abs(qty); // adjustment keeps its own sign; others are always stored positive, sign applied at read-time
  const info = db.prepare(`
    INSERT INTO stock_transactions (item_id, warehouse_id, transaction_type, quantity, reference, po_id, department, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(item_id, warehouse_id, transaction_type, storedQty, reference, po_id, department, req.user.id);

  const transaction = db.prepare('SELECT * FROM stock_transactions WHERE id = ?').get(info.lastInsertRowid);
  audit(req, { action: 'STOCK_TRANSACTION', tableName: 'stock_transactions', recordId: transaction.id, newValue: transaction });
  res.status(201).json({ transaction });
});

router.get('/transactions', (req, res) => {
  const { item_id, warehouse_id, transaction_type, from_date, to_date } = req.query;
  let query = 'SELECT * FROM stock_transactions WHERE 1=1';
  const params = [];
  if (item_id) { query += ' AND item_id = ?'; params.push(item_id); }
  if (warehouse_id) { query += ' AND warehouse_id = ?'; params.push(warehouse_id); }
  if (transaction_type) { query += ' AND transaction_type = ?'; params.push(transaction_type); }
  if (from_date) { query += ' AND created_at >= ?'; params.push(from_date); }
  if (to_date) { query += ' AND created_at <= ?'; params.push(to_date); }
  query += ' ORDER BY created_at DESC LIMIT 500';
  res.json({ transactions: db.prepare(query).all(...params) });
});

// Receive against a Purchase Order — this is the concrete Procurement -> Inventory link:
// approving/receiving a PO in routes/procurement.js does NOT itself touch stock; this endpoint
// posts the actual 'receive' transaction once goods physically arrive (which may be partial).
router.post('/receive-po', requireManagement, (req, res) => {
  const { po_id, warehouse_id, item_id, received_quantity } = req.body;
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(po_id);
  if (!po) return res.status(404).json({ error: 'PO পাওয়া যায়নি' });
  if (!['approved', 'sent', 'partially_received'].includes(po.status)) {
    return res.status(400).json({ error: 'শুধুমাত্র approved/sent/partially_received PO-তে receiving করা যাবে' });
  }
  const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(item_id);
  if (!item) return res.status(400).json({ error: 'সঠিক item_id দিন (আগে Item Master-এ যোগ করুন)' });
  const warehouse = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(warehouse_id);
  if (!warehouse) return res.status(400).json({ error: 'সঠিক warehouse_id দিন' });
  const qty = Number(received_quantity);
  if (!qty || qty <= 0) return res.status(400).json({ error: 'received_quantity একটি ধনাত্মক সংখ্যা হতে হবে' });

  const alreadyReceived = db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) AS n FROM stock_transactions WHERE po_id = ? AND transaction_type = 'receive'
  `).get(po_id).n;
  const totalAfter = alreadyReceived + qty;
  const newStatus = totalAfter >= po.quantity ? 'received' : 'partially_received';

  const postReceipt = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO stock_transactions (item_id, warehouse_id, transaction_type, quantity, reference, po_id, created_by)
      VALUES (?, ?, 'receive', ?, ?, ?, ?)
    `).run(item_id, warehouse_id, qty, po.po_number, po_id, req.user.id);
    db.prepare(`UPDATE purchase_orders SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(newStatus, po_id);
    return info.lastInsertRowid;
  });
  const txnId = postReceipt();

  const transaction = db.prepare('SELECT * FROM stock_transactions WHERE id = ?').get(txnId);
  audit(req, { action: 'PO_RECEIVE', tableName: 'stock_transactions', recordId: transaction.id, newValue: transaction });
  res.status(201).json({ transaction, po_status: newStatus, total_received: totalAfter, po_quantity: po.quantity });
});

// ==================== DASHBOARD: Reorder / Aging / Dead Stock ====================
router.get('/dashboard', (req, res) => {
  const belowReorder = db.prepare(`
    SELECT i.id, i.item_code, i.item_name, i.reorder_level,
      COALESCE(SUM(CASE WHEN t.transaction_type IN ('receive','return','transfer_in') THEN t.quantity
                         WHEN t.transaction_type IN ('issue','transfer_out') THEN -t.quantity
                         WHEN t.transaction_type = 'adjustment' THEN t.quantity ELSE 0 END), 0) AS current_stock
    FROM inventory_items i LEFT JOIN stock_transactions t ON t.item_id = i.id
    WHERE i.is_active = 1 GROUP BY i.id HAVING current_stock <= i.reorder_level
  `).all();

  // Dead stock: items with stock on hand but no 'issue' movement in the last 90 days.
  const deadStock = db.prepare(`
    SELECT i.id, i.item_code, i.item_name,
      COALESCE(SUM(CASE WHEN t.transaction_type IN ('receive','return','transfer_in') THEN t.quantity
                         WHEN t.transaction_type IN ('issue','transfer_out') THEN -t.quantity
                         WHEN t.transaction_type = 'adjustment' THEN t.quantity ELSE 0 END), 0) AS current_stock,
      MAX(CASE WHEN t.transaction_type = 'issue' THEN t.created_at END) AS last_issued_at
    FROM inventory_items i LEFT JOIN stock_transactions t ON t.item_id = i.id
    WHERE i.is_active = 1 GROUP BY i.id
    HAVING current_stock > 0 AND (last_issued_at IS NULL OR last_issued_at < datetime('now', '-90 days'))
  `).all();

  res.json({ below_reorder_level: belowReorder, dead_stock: deadStock });
});

module.exports = router;
