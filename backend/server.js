require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const attendanceRoutes = require('./routes/attendance');
const complaintRoutes = require('./routes/complaints');
const checklistRoutes = require('./routes/checklist');
const policyRoutes = require('./routes/policies');
const salaryRoutes = require('./routes/salary');
const kpiRoutes = require('./routes/kpi');
const trainingRoutes = require('./routes/training');
const opsRoutes = require('./ops');
const auditRoutes = require('./routes/audit');
const documentV2Routes = require('./routes/documents-v2');
const scaleHealthRoutes = require('./routes/scale-health');
const enterpriseRoutes = require('./routes/enterprise');
const capaRoutes = require('./routes/capa');
const riskRoutes = require('./routes/risk');
const auditManagementRoutes = require('./routes/audit-management');
const conferenceRoutes = require('./routes/conferences');
const communicationRoutes = require('./routes/communication');
const hrmRoutes = require('./routes/hrm');
const productionRoutes = require('./routes/production');
const procurementRoutes = require('./routes/procurement');
const inventoryRoutes = require('./routes/inventory');
const isoManagementRoutes = require('./routes/iso-management');

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true, credentials: true }));
app.use(rateLimit({ windowMs: 60 * 1000, limit: Number(process.env.API_RATE_LIMIT_PER_MINUTE || 1200), standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(express.json({ limit: '2mb' }));

// Immutable request-level audit trail for authenticated write operations.
app.use((req, res, next) => {
  if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) return next();
  res.on('finish', () => {
    if (!req.user || res.statusCode >= 500) return;
    try {
      const db = require('./db');
      db.prepare('INSERT INTO audit_logs (user_id, action, table_name, record_id, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)')
        .run(req.user.id, `${req.method} ${req.path}`, req.path, req.params?.id || null, req.ip || null, req.get('user-agent') || null);
    } catch (e) { console.error('Request audit failed:', e.message); }
  });
  next();
});

// serve uploaded files (voice notes, policy PDFs, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// serve the frontend (PWA) so the whole app runs from one server/port
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html', dotfiles: 'ignore' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'RIZVI_FOMS', version: process.env.APP_VERSION || '2026.08.27-enterprise', time: new Date().toISOString() });
});

app.get('/api/ready', (req, res) => {
  try {
    const db = require('./db');
    db.prepare('SELECT 1').get();
    res.json({ ready: true, database: 'ok', time: new Date().toISOString() });
  } catch (e) {
    res.status(503).json({ ready: false, database: 'error' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/checklist', checklistRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/kpi', kpiRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/ops', opsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/v2/documents', documentV2Routes);
app.use('/api/v2/scale-health', scaleHealthRoutes);
app.use('/api/v2/enterprise', enterpriseRoutes);
app.use('/api/capa', capaRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/audit-management', auditManagementRoutes);
app.use('/api/conferences', conferenceRoutes);
app.use('/api/communication', communicationRoutes);
app.use('/api/hrm', hrmRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/procurement', procurementRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/iso-management', isoManagementRoutes);

// fallback to index.html for any non-API route (so refresh works on the PWA)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'সার্ভারে একটি সমস্যা হয়েছে (Internal server error)' });
});

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`\n🟢 RIZVI_DREAMS server চালু হয়েছে`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://<এই-কম্পিউটারের-IP>:${PORT}  (একই WiFi-তে থাকা ফোন/ল্যাপটপ থেকে ব্যবহার করতে)\n`);
});
