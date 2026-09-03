/**
 * RIZVI_DREAMS — Initial Setup Seeder
 * ------------------------------------
 * ব্যবহার: node scripts/seed_admin.js
 *
 * এটি তৈরি করবে:
 *   ১. একটি Admin অ্যাকাউন্ট (.env-এর ADMIN_EMPLOYEE_CODE / ADMIN_PASSWORD থেকে)
 *   ২. কিছু ডিফল্ট KPI Checklist আইটেম (উদাহরণস্বরূপ)
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../db');

const ADMIN_CODE = process.env.ADMIN_EMPLOYEE_CODE || 'ADMIN001';
const ADMIN_NAME = process.env.ADMIN_NAME || 'System Administrator';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeThisPassword123!';

const existing = db.prepare('SELECT id FROM users WHERE employee_code = ?').get(ADMIN_CODE);

if (existing) {
  console.log(`ℹ️  অ্যাডমিন অ্যাকাউন্ট "${ADMIN_CODE}" ইতিমধ্যে বিদ্যমান — কিছু পরিবর্তন করা হয়নি।`);
} else {
  const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  db.prepare(`
    INSERT INTO users (employee_code, name, password, role, must_change_password)
    VALUES (?, ?, ?, 'admin', 1)
  `).run(ADMIN_CODE, ADMIN_NAME, hash);
  console.log(`✅ অ্যাডমিন অ্যাকাউন্ট তৈরি হয়েছে:`);
  console.log(`   Username: ${ADMIN_CODE}`);
  console.log(`   Password: ${ADMIN_PASSWORD}  (প্রথম লগইনে বদলাতে হবে)`);
}

// ---------- default KPI checklist items ----------
const defaultItems = [
  'নির্ধারিত সময়ে উপস্থিত হয়েছেন',
  'PPE / সেফটি গিয়ার সঠিকভাবে ব্যবহার করেছেন',
  'কর্মস্থল পরিষ্কার-পরিচ্ছন্ন রেখেছেন',
  'দৈনিক উৎপাদন লক্ষ্যমাত্রা পূরণ করেছেন',
  'কোনো সেফটি/কমপ্লায়েন্স ইস্যু রিপোর্ট করেছেন কিনা',
];

const findItem = db.prepare('SELECT id FROM checklist_items WHERE title = ?');
const insertItem = db.prepare('INSERT INTO checklist_items (title) VALUES (?)');

let added = 0;
for (const title of defaultItems) {
  if (!findItem.get(title)) {
    insertItem.run(title);
    added++;
  }
}
console.log(`✅ ${added} টি নতুন KPI checklist আইটেম যোগ হয়েছে (মোট টেমপ্লেট: ${defaultItems.length})।`);

// ---------- Director account ----------
const DIRECTOR_CODE = process.env.DIRECTOR_EMPLOYEE_CODE || 'DIRECTOR001';
const DIRECTOR_NAME = process.env.DIRECTOR_NAME || 'Director/MD/GM';
const DIRECTOR_PASSWORD = process.env.DIRECTOR_PASSWORD || 'ChangeThisPassword123!';
if (!db.prepare('SELECT id FROM users WHERE employee_code = ?').get(DIRECTOR_CODE)) {
  const hash = bcrypt.hashSync(DIRECTOR_PASSWORD, 10);
  db.prepare(`INSERT INTO users (employee_code, name, password, role, must_change_password) VALUES (?, ?, ?, 'director', 1)`)
    .run(DIRECTOR_CODE, DIRECTOR_NAME, hash);
  console.log(`✅ ডিরেক্টর অ্যাকাউন্ট তৈরি হয়েছে: Username: ${DIRECTOR_CODE}  Password: ${DIRECTOR_PASSWORD} (প্রথম লগইনে বদলাতে হবে)`);
} else {
  console.log(`ℹ️  ডিরেক্টর অ্যাকাউন্ট "${DIRECTOR_CODE}" ইতিমধ্যে বিদ্যমান।`);
}

console.log('\nDepartment/Section admin accounts তৈরি করতে: node scripts/seed_scoped_admins.js');
console.log('সেটআপ সম্পন্ন। এখন "npm start" দিয়ে সার্ভার চালু করুন।\n');
