const db = require('../db');

function audit(req, { action, tableName = null, recordId = null, oldValue = null, newValue = null } = {}) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, table_name, record_id, old_value, new_value, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user?.id || null,
      String(action || 'UNKNOWN'),
      tableName,
      recordId == null ? null : String(recordId),
      oldValue == null ? null : JSON.stringify(oldValue),
      newValue == null ? null : JSON.stringify(newValue),
      req.ip || null,
      req.get('user-agent') || null
    );
  } catch (e) {
    console.error('Audit log failed:', e.message);
  }
}

module.exports = { audit };
