// ============================================================
// INTEGRATED ISO MANAGEMENT SYSTEM
// Standard-wise compliance matrix + proper Document Control (unique ID,
// version, approval-before-issue, periodic review, controlled distribution/
// acknowledgement, obsolete handling). A non-compliant clause can open a
// CAPA record in the shared engine, same pattern used throughout.
// ============================================================
const express = require('express');
const db = require('../db');
const { authenticate, requireManagement, requireAdminOrDirector } = require('../middleware/auth');
const { audit } = require('../lib/audit');

const router = express.Router();
router.use(authenticate);

const STANDARD_CODES = ['ISO_9001', 'ISO_14001', 'ISO_45001', 'ISO_27001', 'ISO_50001', 'ISO_37301'];
const STANDARD_NAMES = {
  ISO_9001: 'ISO 9001 — Quality Management', ISO_14001: 'ISO 14001 — Environmental Management',
  ISO_45001: 'ISO 45001 — Occupational Health & Safety', ISO_27001: 'ISO/IEC 27001 — Information Security',
  ISO_50001: 'ISO 50001 — Energy Management', ISO_37301: 'ISO 37301 — Compliance Management',
};
const CERT_STATUSES = ['not_applicable', 'pursuing', 'certified', 'expired'];
const COMPLIANCE_STATUSES = ['compliant', 'non_compliant', 'not_applicable', 'in_progress'];
const DOC_TYPES = ['policy', 'sop', 'work_instruction', 'form', 'record', 'manual'];
const DOC_STATUSES = ['draft', 'under_review', 'approved', 'published', 'obsolete'];

// ==================== ISO STANDARDS MATRIX ====================
router.get('/standards', (req, res) => {
  // Auto-seed the six standards on first call so the matrix always shows all of them.
  const insert = db.prepare(`INSERT OR IGNORE INTO iso_standards (code, name) VALUES (?, ?)`);
  for (const code of STANDARD_CODES) insert.run(code, STANDARD_NAMES[code]);
  res.json({ standards: db.prepare('SELECT * FROM iso_standards ORDER BY code').all() });
});

router.put('/standards/:code', requireAdminOrDirector, (req, res) => {
  if (!STANDARD_CODES.includes(req.params.code)) return res.status(404).json({ error: 'Unknown ISO standard code' });
  const { certification_status, certificate_expiry_date = null } = req.body;
  if (!CERT_STATUSES.includes(certification_status)) return res.status(400).json({ error: `certification_status must be one of: ${CERT_STATUSES.join(', ')}` });
  db.prepare(`INSERT OR IGNORE INTO iso_standards (code, name) VALUES (?, ?)`).run(req.params.code, STANDARD_NAMES[req.params.code]);
  db.prepare(`UPDATE iso_standards SET certification_status = ?, certificate_expiry_date = ? WHERE code = ?`).run(certification_status, certificate_expiry_date, req.params.code);
  res.json({ standard: db.prepare('SELECT * FROM iso_standards WHERE code = ?').get(req.params.code) });
});

// ==================== CLAUSE COMPLIANCE ====================
router.post('/clauses', requireManagement, (req, res) => {
  const { standard_code, clause_number, clause_description = null, department = null, evidence = null } = req.body;
  if (!STANDARD_CODES.includes(standard_code)) return res.status(400).json({ error: `standard_code must be one of: ${STANDARD_CODES.join(', ')}` });
  if (!clause_number) return res.status(400).json({ error: 'clause_number আবশ্যক' });
  db.prepare(`INSERT OR IGNORE INTO iso_standards (code, name) VALUES (?, ?)`).run(standard_code, STANDARD_NAMES[standard_code]);

  const info = db.prepare(`
    INSERT INTO iso_clause_compliance (standard_code, clause_number, clause_description, department, evidence, compliance_status)
    VALUES (?, ?, ?, ?, ?, 'in_progress')
  `).run(standard_code, clause_number, clause_description, department, evidence);
  res.status(201).json({ clause: db.prepare('SELECT * FROM iso_clause_compliance WHERE id = ?').get(info.lastInsertRowid) });
});

router.get('/clauses', (req, res) => {
  const { standard_code, compliance_status, department } = req.query;
  let query = 'SELECT * FROM iso_clause_compliance WHERE 1=1';
  const params = [];
  if (standard_code) { query += ' AND standard_code = ?'; params.push(standard_code); }
  if (compliance_status) { query += ' AND compliance_status = ?'; params.push(compliance_status); }
  if (department) { query += ' AND department = ?'; params.push(department); }
  query += ' ORDER BY standard_code, clause_number';
  res.json({ clauses: db.prepare(query).all(...params) });
});

// Marking a clause non_compliant automatically opens a record in the shared CAPA engine —
// consistent with checklist NCs (Phase 2), audit findings (Phase 3), and buyer complaints (Phase 5).
router.put('/clauses/:id', requireManagement, (req, res) => {
  const existing = db.prepare('SELECT * FROM iso_clause_compliance WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Clause পাওয়া যায়নি' });
  const { compliance_status, evidence, severity = 'major' } = req.body;
  if (compliance_status && !COMPLIANCE_STATUSES.includes(compliance_status)) {
    return res.status(400).json({ error: `compliance_status must be one of: ${COMPLIANCE_STATUSES.join(', ')}` });
  }

  let capaId = existing.capa_id;
  const applyUpdate = db.transaction(() => {
    if (compliance_status === 'non_compliant' && !existing.capa_id) {
      const capaInfo = db.prepare(`
        INSERT INTO capa_records (source_module, source_type, source_reference_id, department, problem, nc_description, severity, status, raised_by)
        VALUES ('audit', 'nc', ?, ?, ?, ?, ?, 'open', ?)
      `).run(req.params.id, existing.department, `ISO non-conformity: ${existing.standard_code} clause ${existing.clause_number}`, existing.clause_description || '', ['minor', 'major', 'critical'].includes(severity) ? severity : 'major', req.user.id);
      capaId = capaInfo.lastInsertRowid;
    }
    db.prepare(`
      UPDATE iso_clause_compliance SET
        compliance_status = COALESCE(?, compliance_status),
        evidence = COALESCE(?, evidence),
        capa_id = ?,
        last_reviewed_date = date('now'),
        reviewed_by = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(compliance_status || null, evidence || null, capaId, req.user.id, req.params.id);
  });
  applyUpdate();

  const clause = db.prepare('SELECT * FROM iso_clause_compliance WHERE id = ?').get(req.params.id);
  audit(req, { action: 'ISO_CLAUSE_UPDATE', tableName: 'iso_clause_compliance', recordId: clause.id, oldValue: existing, newValue: clause });
  res.json({ clause, capa_opened: capaId !== existing.capa_id ? capaId : null });
});

// Compliance matrix summary — % compliant per standard, non-conformities still open
router.get('/dashboard', (req, res) => {
  const byStandard = db.prepare(`
    SELECT standard_code,
      COUNT(*) AS total_clauses,
      SUM(CASE WHEN compliance_status = 'compliant' THEN 1 ELSE 0 END) AS compliant,
      SUM(CASE WHEN compliance_status = 'non_compliant' THEN 1 ELSE 0 END) AS non_compliant,
      ROUND(100.0 * SUM(CASE WHEN compliance_status = 'compliant' THEN 1 ELSE 0 END) / COUNT(*), 2) AS compliance_pct
    FROM iso_clause_compliance GROUP BY standard_code
  `).all();
  const openNonConformities = db.prepare(`
    SELECT icc.*, cr.status AS capa_status FROM iso_clause_compliance icc
    LEFT JOIN capa_records cr ON cr.id = icc.capa_id
    WHERE icc.compliance_status = 'non_compliant' AND (cr.status IS NULL OR cr.status NOT IN ('verified','closed'))
  `).all();
  res.json({ by_standard: byStandard, open_non_conformities: openNonConformities });
});

// ==================== DOCUMENT CONTROL ====================
router.post('/documents', requireManagement, (req, res) => {
  const { document_code, title, document_type = 'sop', department = null, owner_id = null, file_path = null, supersedes_id = null } = req.body;
  if (!document_code || !title) return res.status(400).json({ error: 'document_code এবং title আবশ্যক' });
  if (!DOC_TYPES.includes(document_type)) return res.status(400).json({ error: `document_type must be one of: ${DOC_TYPES.join(', ')}` });
  if (db.prepare('SELECT id FROM controlled_documents WHERE document_code = ?').get(document_code)) {
    return res.status(409).json({ error: 'এই document_code ইতিমধ্যে বিদ্যমান' });
  }

  const info = db.prepare(`
    INSERT INTO controlled_documents (document_code, title, document_type, department, owner_id, file_path, supersedes_id, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)
  `).run(document_code, title, document_type, department, owner_id, file_path, supersedes_id, req.user.id);

  const document = db.prepare('SELECT * FROM controlled_documents WHERE id = ?').get(info.lastInsertRowid);
  audit(req, { action: 'DOCUMENT_CREATE', tableName: 'controlled_documents', recordId: document.id, newValue: document });
  res.status(201).json({ document });
});

router.get('/documents', (req, res) => {
  const { status, department, document_type } = req.query;
  let query = 'SELECT * FROM controlled_documents WHERE 1=1';
  const params = [];
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (department) { query += ' AND department = ?'; params.push(department); }
  if (document_type) { query += ' AND document_type = ?'; params.push(document_type); }
  query += ' ORDER BY updated_at DESC';
  res.json({ documents: db.prepare(query).all(...params) });
});

// draft -> under_review -> approved -> published ; published -> obsolete (only when superseded)
router.put('/documents/:id/status', requireAdminOrDirector, (req, res) => {
  const existing = db.prepare('SELECT * FROM controlled_documents WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Document পাওয়া যায়নি' });
  const { status, effective_date, next_review_date } = req.body;
  if (!DOC_STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of: ${DOC_STATUSES.join(', ')}` });

  db.prepare(`
    UPDATE controlled_documents SET status = ?,
      approved_by = CASE WHEN ? = 'approved' THEN ? ELSE approved_by END,
      approved_at = CASE WHEN ? = 'approved' THEN datetime('now') ELSE approved_at END,
      effective_date = COALESCE(?, effective_date),
      next_review_date = COALESCE(?, next_review_date),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(status, status, req.user.id, status, effective_date || null, next_review_date || null, req.params.id);

  // Publishing a new version supersedes and obsoletes the document it replaces, so only one
  // version of a given document is ever "published" at a time (prevents unintended use of an
  // obsolete document — ISO 9001 7.5.3.b).
  if (status === 'published' && existing.supersedes_id) {
    db.prepare(`UPDATE controlled_documents SET status = 'obsolete', updated_at = datetime('now') WHERE id = ?`).run(existing.supersedes_id);
  }

  const document = db.prepare('SELECT * FROM controlled_documents WHERE id = ?').get(req.params.id);
  audit(req, { action: 'DOCUMENT_STATUS', tableName: 'controlled_documents', recordId: document.id, oldValue: existing, newValue: document });
  res.json({ document });
});

// Publishing a new version fans out an unacknowledged row per active employee in the document's
// department (or everyone, if department is NULL), same pattern as circular_reads.
router.post('/documents/:id/distribute', requireManagement, (req, res) => {
  const document = db.prepare('SELECT * FROM controlled_documents WHERE id = ?').get(req.params.id);
  if (!document) return res.status(404).json({ error: 'Document পাওয়া যায়নি' });
  if (document.status !== 'published') return res.status(400).json({ error: 'শুধুমাত্র published document distribute করা যাবে' });

  let recipientQuery = "SELECT id FROM employees WHERE status = 'Active'";
  const params = [];
  if (document.department) { recipientQuery += ' AND department = ?'; params.push(document.department); }
  const recipients = db.prepare(recipientQuery).all(...params);

  const insert = db.prepare(`INSERT OR IGNORE INTO document_acknowledgments (document_id, employee_id) VALUES (?, ?)`);
  const fanOut = db.transaction(() => { for (const r of recipients) insert.run(req.params.id, r.id); });
  fanOut();

  res.json({ message: 'Document বিতরণ করা হয়েছে', recipient_count: recipients.length });
});

router.put('/documents/:id/acknowledge/:employeeId', (req, res) => {
  const row = db.prepare('SELECT * FROM document_acknowledgments WHERE document_id = ? AND employee_id = ?').get(req.params.id, req.params.employeeId);
  if (!row) return res.status(404).json({ error: 'এই document আপনার জন্য পাঠানো হয়নি' });
  db.prepare(`UPDATE document_acknowledgments SET acknowledged_at = datetime('now') WHERE document_id = ? AND employee_id = ?`).run(req.params.id, req.params.employeeId);
  res.json({ message: 'Acknowledge করা হয়েছে' });
});

router.get('/documents/:id/acknowledgment-status', requireManagement, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) AS n FROM document_acknowledgments WHERE document_id = ?').get(req.params.id).n;
  const acknowledged = db.prepare('SELECT COUNT(*) AS n FROM document_acknowledgments WHERE document_id = ? AND acknowledged_at IS NOT NULL').get(req.params.id).n;
  res.json({ total, acknowledged, pending: total - acknowledged });
});

// Documents due for periodic review (instruction's Record/Document Control review cycle)
router.get('/documents-due-for-review', requireManagement, (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM controlled_documents
    WHERE status = 'published' AND next_review_date IS NOT NULL AND next_review_date <= date('now', '+30 days')
    ORDER BY next_review_date ASC
  `).all();
  res.json({ documents: rows });
});

module.exports = router;
