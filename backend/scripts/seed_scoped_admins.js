/**
 * RIZVI FOMS — Department/Section Admin Seeder
 * ---------------------------------------------
 * ব্যবহার: node scripts/seed_scoped_admins.js
 *
 * enterprise-master-data.json-এর সব departments (91) ও sections (156) নাম ধরে
 * একটি করে department_admin / section_admin অ্যাকাউন্ট তৈরি করে — প্রতিটির
 * employee_code তার নিজের department/section নাম-ভিত্তিক (একটি নির্দিষ্ট
 * department/section-এর জন্য একজন করে অ্যাডমিন — instruction অনুযায়ী "SECTION
 * Admin 156 টি SECTION-এর যেকোনো SECTION-এর নাম লিখবেন")।
 *
 * নিরাপত্তা নোট: instruction-এ department/section admin-দের জন্য একটি common
 * (সবার জন্য একই) initial password উল্লেখ আছে। ৯১টি department admin বা ১৫৬টি
 * section admin-এর সবার একই স্থায়ী পাসওয়ার্ড রাখা asli নিরাপত্তা ঝুঁকি — তাই এটি
 * শুধু initial/temporary পাসওয়ার্ড হিসেবে সেট করা হলো, must_change_password=1
 * দিয়ে, ঠিক Admin/Director অ্যাকাউন্টের মতোই — প্রথম লগইনেই বদলাতে হবে।
 *
 * instruction-এ Section Admin-এর পাসওয়ার্ড লেখা "Dept123456" আর Department
 * Admin-এর "Sec123456" — নামগুলো পরস্পর অদল-বদল মনে হচ্ছে (সম্ভবত টাইপো)।
 * নিচের ডিফল্ট এই মেসেজেই যা লেখা হয়েছে সেটাই হুবহু রাখা হলো; ভুল হয়ে থাকলে
 * .env-এ SECTION_ADMIN_DEFAULT_PASSWORD / DEPARTMENT_ADMIN_DEFAULT_PASSWORD
 * সেট করে ঠিক মান দিয়ে override করুন।
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../db');
const masterData = require('../../enterprise-master-data.json');

const SECTION_ADMIN_DEFAULT_PASSWORD = process.env.SECTION_ADMIN_DEFAULT_PASSWORD || 'Dept123456';
const DEPARTMENT_ADMIN_DEFAULT_PASSWORD = process.env.DEPARTMENT_ADMIN_DEFAULT_PASSWORD || 'Sec123456';

function slugify(name) {
  return String(name).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function seedScopedAdmin({ code, name, password, role, scopeType, scopeValue }) {
  const existing = db.prepare('SELECT id FROM users WHERE employee_code = ?').get(code);
  if (existing) {
    // Keep an already-created account as-is (don't reset a password someone may have already changed).
    return 'skipped';
  }
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(`
    INSERT INTO users (employee_code, name, password, role, scope_type, scope_value, must_change_password)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(code, name, hash, role, scopeType, scopeValue);
  return 'created';
}

let deptCreated = 0, deptSkipped = 0;
for (const deptName of masterData.departments) {
  const code = `DEPT-ADMIN-${slugify(deptName)}`;
  const result = seedScopedAdmin({
    code, name: `Department Admin — ${deptName}`, password: DEPARTMENT_ADMIN_DEFAULT_PASSWORD,
    role: 'department_admin', scopeType: 'department', scopeValue: deptName,
  });
  if (result === 'created') deptCreated++; else deptSkipped++;
}

let secCreated = 0, secSkipped = 0;
for (const secName of masterData.sections) {
  const code = `SEC-ADMIN-${slugify(secName)}`;
  const result = seedScopedAdmin({
    code, name: `Section Admin — ${secName}`, password: SECTION_ADMIN_DEFAULT_PASSWORD,
    role: 'section_admin', scopeType: 'section', scopeValue: secName,
  });
  if (result === 'created') secCreated++; else secSkipped++;
}

console.log(`✅ Department Admin: ${deptCreated} টি নতুন তৈরি হয়েছে, ${deptSkipped} টি আগে থেকেই ছিল (মোট ${masterData.departments.length} departments)।`);
console.log(`✅ Section Admin: ${secCreated} টি নতুন তৈরি হয়েছে, ${secSkipped} টি আগে থেকেই ছিল (মোট ${masterData.sections.length} sections)।`);
console.log(`\nDepartment Admin login উদাহরণ: DEPT-ADMIN-${slugify(masterData.departments[0])}  Password: ${DEPARTMENT_ADMIN_DEFAULT_PASSWORD}`);
console.log(`Section Admin login উদাহরণ:    SEC-ADMIN-${slugify(masterData.sections[0])}  Password: ${SECTION_ADMIN_DEFAULT_PASSWORD}`);
console.log('প্রথম লগইনেই পাসওয়ার্ড বদলাতে হবে (must_change_password)।\n');
