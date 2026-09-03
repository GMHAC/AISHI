const express = require('express');
const db = require('../db');
const { authenticate, requireAdminOrDirector, requireManagement, requireScopeAccess } = require('../middleware/auth');
const { audit } = require('../lib/audit');
const router = express.Router();
router.use(authenticate);

const MODULES = {
  corporate:'Corporate & Strategic Management', communication:'Management Communication & Live Conference',
  marketing:'Marketing & Merchandising', fabrics:'Fabric Management', procurement:'Procurement Management',
  inventory:'Inventory & Store Management', traceability:'Marking & Traceability Management', production:'Production Management',
  iso:'Integrated ISO Management System', tracking:'Live Tracking / Mobile Workforce',
  payroll:'Attendance & Payroll Management', hr:'HRM – Full Human Resource Management'
};
// Marketing & Merchandising pipeline stages (instruction section 13: Buyer & Trading House ->
// Communication -> Inquiry -> Costing -> Style Development -> Tech Pack -> Sample -> Order ->
// T&A -> Delay Management -> Production Follow-up -> Shipment -> Buyer Feedback -> Complaint ->
// CAPA -> Buyer Rating -> Merchandiser KPI). Kept as a soft whitelist (not enforced on every
// module) so the marketing module's events line up with a known pipeline stage instead of being
// arbitrary free text, while other modules keep using their own event_type vocabulary.
const MARKETING_EVENT_TYPES = ['communication','inquiry','costing','style_development','tech_pack','sample','order','t_and_a','delay_management','production_follow_up','shipment','buyer_feedback','complaint','buyer_rating'];
const DEFAULT_CHECKLIST = ['Daily Checklist','Weekly Checklist','Monthly Checklist','Periodic Checklist','ISO Checklist','Buyer Checklist','Legal/Regulatory Checklist','Internal Checklist','Department Checklist','Employee Responsibility Checklist'];
function json(v){ try{return JSON.parse(v||'{}')}catch{return {}} }
function list(module){
  return db.prepare('SELECT * FROM enterprise_events WHERE module = ? ORDER BY created_at DESC LIMIT 500').all(module).map(x=>({...x,payload:json(x.payload)}));
}
router.get('/modules',(req,res)=>res.json({modules:Object.entries(MODULES).map(([id,name])=>({id,name,checklists:DEFAULT_CHECKLIST}))}));
router.get('/events/:module',(req,res)=>{ if(!MODULES[req.params.module]) return res.status(404).json({error:'Unknown module'}); res.json({module:req.params.module,events:list(req.params.module)}); });

// Allow department_admin / section_admin to log events too (scoped to their own department/
// section), not just admin/director — matches Phase 4's "hourly task update" requirement.
router.post('/events', requireManagement, requireScopeAccess(
  (req) => req.body.department, (req) => req.body.section,
), (req, res) => {
  const b=req.body||{}; if(!b.module||!MODULES[b.module]) return res.status(400).json({error:'valid module required'});
  if (b.module === 'marketing' && b.event_type && !MARKETING_EVENT_TYPES.includes(b.event_type)) {
    return res.status(400).json({ error: `marketing event_type must be one of: ${MARKETING_EVENT_TYPES.join(', ')}` });
  }

  let capaId = null;
  const insertEvent = db.transaction(() => {
    const info = db.prepare(`INSERT INTO enterprise_events(event_type,module,employee_code,department,section,designation,payload,status,created_by) VALUES(?,?,?,?,?,?,?,?,?)`).run(
      b.event_type||'operation',b.module,b.employee_code||null,b.department||null,b.section||null,b.designation||null,JSON.stringify(b.payload||{}),b.status||'open',req.user.id);
    const eventId = info.lastInsertRowid;

    // Buyer Feedback -> Complaint -> CAPA (instruction's Marketing & Merchandising pipeline):
    // a marketing 'complaint' event automatically opens a record in the shared CAPA engine,
    // same pattern as checklist non-conformities (Phase 2) and audit findings (Phase 3).
    if (b.module === 'marketing' && b.event_type === 'complaint') {
      const payload = b.payload || {};
      const capaInfo = db.prepare(`
        INSERT INTO capa_records (source_module, source_type, source_reference_id, department, section, problem, nc_description, severity, deadline, status, raised_by)
        VALUES ('buyer', 'incident', ?, ?, ?, ?, ?, ?, ?, 'open', ?)
      `).run(eventId, b.department, b.section, `Buyer complaint${payload.buyer ? ` (${payload.buyer})` : ''}`, payload.description || payload.note || JSON.stringify(payload), payload.severity && ['minor','major','critical'].includes(payload.severity) ? payload.severity : 'major', payload.deadline || null, req.user.id);
      capaId = capaInfo.lastInsertRowid;
    }
    return eventId;
  });
  const eventId = insertEvent();

  const row=db.prepare('SELECT * FROM enterprise_events WHERE id=?').get(eventId);
  audit(req, { action: 'ENTERPRISE_EVENT_CREATE', tableName: 'enterprise_events', recordId: eventId, newValue: row });
  res.status(201).json({...row,payload:json(row.payload), capa_opened: capaId});
});
router.get('/tracking',(req,res)=>{
  const rows=db.prepare("SELECT * FROM enterprise_events WHERE module='tracking' ORDER BY created_at DESC LIMIT 200").all();
  res.json({points:rows.map(x=>({...x,payload:json(x.payload)}))});
});
router.get('/employee/:code/responsibility',(req,res)=>{
  const code=String(req.params.code||'').trim();
  const employee=db.prepare('SELECT * FROM employees WHERE employee_code=? OR punched_id=?').get(code,code);
  if(!employee) return res.status(404).json({error:'Employee/ID card not found'});
  const profile=db.prepare('SELECT * FROM employee_responsibility_profiles WHERE employee_code=?').get(employee.employee_code);
  const checklist=DEFAULT_CHECKLIST;
  res.json({employee,responsibility:profile||{
    employee_code:employee.employee_code, department:employee.department, section:employee.section, designation:employee.designation,
    reporting_to:null, job_responsibility:null, authority_level:null, approval_authority:null, kpi:null, required_competency:null,
    training_requirement:null, daily_responsibility:null, weekly_responsibility:null, monthly_responsibility:null, iso_responsibility:null,
    applicable_checklist:checklist, assigned_workflow:null, task_template:null, document_access:null, dashboard_access:null, permission_level:null,
    source:'PDF/master fields require authorized configuration'
  }, checklist});
});
router.post('/employee/:code/responsibility',requireAdminOrDirector,(req,res)=>{
  const code=String(req.params.code||'').trim(); const e=db.prepare('SELECT employee_code,department,section,designation FROM employees WHERE employee_code=? OR punched_id=?').get(code,code);
  if(!e) return res.status(404).json({error:'Employee/ID card not found'});
  const b=req.body||{};
  db.prepare(`INSERT INTO employee_responsibility_profiles(employee_code,department,section,designation,reporting_to,job_responsibility,authority_level,approval_authority,kpi,required_competency,training_requirement,daily_responsibility,weekly_responsibility,monthly_responsibility,iso_responsibility,applicable_checklist,assigned_workflow,task_template,document_access,dashboard_access,permission_level,source,updated_at)
  VALUES(@employee_code,@department,@section,@designation,@reporting_to,@job_responsibility,@authority_level,@approval_authority,@kpi,@required_competency,@training_requirement,@daily_responsibility,@weekly_responsibility,@monthly_responsibility,@iso_responsibility,@applicable_checklist,@assigned_workflow,@task_template,@document_access,@dashboard_access,@permission_level,'authorized-config',datetime('now'))
  ON CONFLICT(employee_code) DO UPDATE SET department=excluded.department,section=excluded.section,designation=excluded.designation,reporting_to=excluded.reporting_to,job_responsibility=excluded.job_responsibility,authority_level=excluded.authority_level,approval_authority=excluded.approval_authority,kpi=excluded.kpi,required_competency=excluded.required_competency,training_requirement=excluded.training_requirement,daily_responsibility=excluded.daily_responsibility,weekly_responsibility=excluded.weekly_responsibility,monthly_responsibility=excluded.monthly_responsibility,iso_responsibility=excluded.iso_responsibility,applicable_checklist=excluded.applicable_checklist,assigned_workflow=excluded.assigned_workflow,task_template=excluded.task_template,document_access=excluded.document_access,dashboard_access=excluded.dashboard_access,permission_level=excluded.permission_level,source='authorized-config',updated_at=datetime('now')`).run({
    employee_code:e.employee_code,department:e.department,section:e.section,designation:e.designation,reporting_to:b.reporting_to||null,job_responsibility:b.job_responsibility||null,authority_level:b.authority_level||null,approval_authority:b.approval_authority||null,kpi:b.kpi||null,required_competency:b.required_competency||null,training_requirement:b.training_requirement||null,daily_responsibility:b.daily_responsibility||null,weekly_responsibility:b.weekly_responsibility||null,monthly_responsibility:b.monthly_responsibility||null,iso_responsibility:b.iso_responsibility||null,applicable_checklist:b.applicable_checklist||JSON.stringify(DEFAULT_CHECKLIST),assigned_workflow:b.assigned_workflow||null,task_template:b.task_template||null,document_access:b.document_access||null,dashboard_access:b.dashboard_access||null,permission_level:b.permission_level||null
  });
  res.json({ok:true,employee_code:e.employee_code});
});
router.get('/summary',(req,res)=>{
  const modules=Object.keys(MODULES).map(k=>({id:k,name:MODULES[k],events:db.prepare('SELECT COUNT(*) c FROM enterprise_events WHERE module=?').get(k).c}));
  const employees=db.prepare('SELECT COUNT(*) c FROM employees').get().c; const users=db.prepare('SELECT COUNT(*) c FROM users WHERE is_active=1').get().c;
  res.json({employees,active_users:users,modules,server_time:new Date().toISOString()});
});
module.exports=router;
