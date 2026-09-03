const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required in production');
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev-only-change-me';

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'অনুমোদন প্রয়োজন (No token provided)' });
  }

  try {
    const payload = jwt.verify(token, EFFECTIVE_JWT_SECRET);
    req.user = payload; // { id, employee_code, role, scope_type, scope_value }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'অকার্যকর বা মেয়াদোত্তীর্ণ টোকেন (Invalid or expired token)' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'এই কাজের জন্য পর্যাপ্ত অনুমতি নেই (Insufficient permissions)' });
    }
    next();
  };
}

const requireAdmin = requireRole('admin');
const requireAdminOrDirector = requireRole('admin', 'director');
// Any of the four management/admin roles — used for actions section_admin / department_admin are
// meant to do (checklist updates, document upload, conference scheduling) alongside full admins.
const requireManagement = requireRole('admin', 'director', 'department_admin', 'section_admin');

// ---------- Department/Section scope enforcement ----------
// admin and director have organization-wide access. department_admin may only act within their
// assigned department (users.scope_value); section_admin only within their assigned section.
// departmentGetter/sectionGetter pull the target department/section out of the request
// (query, body, or params) — pass whichever the route uses.
function requireScopeAccess(departmentGetter, sectionGetter) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'অনুমোদন প্রয়োজন' });
    if (['admin', 'director'].includes(req.user.role)) return next();

    if (req.user.role === 'department_admin') {
      const dept = departmentGetter ? departmentGetter(req) : null;
      if (!dept || dept !== req.user.scope_value) {
        return res.status(403).json({ error: `আপনি শুধুমাত্র "${req.user.scope_value}" ডিপার্টমেন্টের জন্য কাজ করতে পারবেন` });
      }
      return next();
    }

    if (req.user.role === 'section_admin') {
      const section = sectionGetter ? sectionGetter(req) : null;
      if (!section || section !== req.user.scope_value) {
        return res.status(403).json({ error: `আপনি শুধুমাত্র "${req.user.scope_value}" সেকশনের জন্য কাজ করতে পারবেন` });
      }
      return next();
    }

    return res.status(403).json({ error: 'এই কাজের জন্য পর্যাপ্ত অনুমতি নেই (Insufficient permissions)' });
  };
}

module.exports = {
  authenticate, requireRole, requireAdmin, requireAdminOrDirector, requireManagement, requireScopeAccess,
  JWT_SECRET: EFFECTIVE_JWT_SECRET,
};
