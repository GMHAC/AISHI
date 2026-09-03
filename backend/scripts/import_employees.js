/**
 * RIZVI_DREAMS — Employee CSV Import
 * -----------------------------------
 * ব্যবহার:
 *   node scripts/import_employees.js "/path/to/employees.csv"
 *
 * এই স্ক্রিপ্ট HR সফটওয়্যার থেকে এক্সপোর্ট করা CSV (Regular_Employee_Data...csv ফরম্যাট)
 * থেকে কর্মীদের তথ্য ডেটাবেজে ইমপোর্ট করবে এবং প্রতিটি কর্মীর জন্য একটি লগইন
 * অ্যাকাউন্ট (role: employee) তৈরি করবে যদি আগে থেকে না থাকে।
 *
 * Employee login username = Employee Id (যেমন "AF1 0001")
 * Employee ডিফল্ট পাসওয়ার্ড = .env-এ DEFAULT_EMPLOYEE_PASSWORD (প্রথম লগইনে বদলাতে বাধ্য করা হয়)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const bcrypt = require('bcryptjs');
const db = require('../db');

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('❌ CSV ফাইলের পাথ দিন: node scripts/import_employees.js "path/to/file.csv"');
  process.exit(1);
}
if (!fs.existsSync(csvPath)) {
  console.error(`❌ ফাইল পাওয়া যায়নি: ${csvPath}`);
  process.exit(1);
}

const DEFAULT_PASSWORD = process.env.DEFAULT_EMPLOYEE_PASSWORD || 'Rizvi@1234';
const DEFAULT_PASSWORD_HASH = bcrypt.hashSync(DEFAULT_PASSWORD, 10);

// strip stray HTML (the Img/Sign columns sometimes contain <img> tags) — unused columns anyway
function clean(val) {
  if (val === undefined || val === null) return null;
  const t = String(val).trim();
  return t === '' ? null : t;
}
function cleanNumber(val) {
  const c = clean(val);
  if (c === null) return null;
  const n = Number(String(c).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}
function cleanInt(val) {
  const n = cleanNumber(val);
  return n === null ? null : Math.round(n);
}

console.log(`📄 পড়া হচ্ছে: ${csvPath}`);
const raw = fs.readFileSync(csvPath, 'utf8');

const records = parse(raw, {
  columns: true,
  skip_empty_lines: true,
  relax_column_count: true,
  bom: true,
});

console.log(`✅ ${records.length} টি রেকর্ড পাওয়া গেছে। ইমপোর্ট শুরু হচ্ছে...`);

const upsertEmployee = db.prepare(`
  INSERT INTO employees (
    employee_code, punched_id, full_name, name_bn, join_date, department, category,
    section, sub_section, designation, job_location, status, job_termination_type,
    termination_date, gross_salary, phone, whatsapp, national_id, birth_certificate,
    bank_account, bank_account_no, routing_number, blood_group, gender, religion,
    job_type, birth_date, payment_mode, email, number_of_child, nationality, weekend,
    payroll_type, grade, job_division, shift_name, transport_service
  ) VALUES (
    @employee_code, @punched_id, @full_name, @name_bn, @join_date, @department, @category,
    @section, @sub_section, @designation, @job_location, @status, @job_termination_type,
    @termination_date, @gross_salary, @phone, @whatsapp, @national_id, @birth_certificate,
    @bank_account, @bank_account_no, @routing_number, @blood_group, @gender, @religion,
    @job_type, @birth_date, @payment_mode, @email, @number_of_child, @nationality, @weekend,
    @payroll_type, @grade, @job_division, @shift_name, @transport_service
  )
  ON CONFLICT(employee_code) DO UPDATE SET
    punched_id=excluded.punched_id, full_name=excluded.full_name, name_bn=excluded.name_bn,
    join_date=excluded.join_date, department=excluded.department, category=excluded.category,
    section=excluded.section, sub_section=excluded.sub_section, designation=excluded.designation,
    job_location=excluded.job_location, status=excluded.status,
    job_termination_type=excluded.job_termination_type, termination_date=excluded.termination_date,
    gross_salary=excluded.gross_salary, phone=excluded.phone, whatsapp=excluded.whatsapp,
    national_id=excluded.national_id, birth_certificate=excluded.birth_certificate,
    bank_account=excluded.bank_account, bank_account_no=excluded.bank_account_no,
    routing_number=excluded.routing_number, blood_group=excluded.blood_group, gender=excluded.gender,
    religion=excluded.religion, job_type=excluded.job_type, birth_date=excluded.birth_date,
    payment_mode=excluded.payment_mode, email=excluded.email, number_of_child=excluded.number_of_child,
    nationality=excluded.nationality, weekend=excluded.weekend, payroll_type=excluded.payroll_type,
    grade=excluded.grade, job_division=excluded.job_division, shift_name=excluded.shift_name,
    transport_service=excluded.transport_service, updated_at=datetime('now')
`);

const findUser = db.prepare('SELECT id FROM users WHERE employee_code = ?');
const insertUser = db.prepare(`
  INSERT INTO users (employee_code, name, password, role, must_change_password)
  VALUES (?, ?, ?, 'employee', 1)
`);

let imported = 0, skipped = 0, usersCreated = 0;

const runAll = db.transaction((rows) => {
  for (const row of rows) {
    const employee_code = clean(row['Employee Id']);
    const full_name = clean(row['Employee Name']);
    if (!employee_code || !full_name) { skipped++; continue; }

    upsertEmployee.run({
      employee_code,
      punched_id: clean(row['Punched Id']),
      full_name,
      name_bn: clean(row['Employee Name 2L']),
      join_date: clean(row['Join Date']),
      department: clean(row['Department']),
      category: clean(row['Category']),
      section: clean(row['Section']),
      sub_section: clean(row['Sub Section']),
      designation: clean(row['Designation']),
      job_location: clean(row['Job Location']),
      status: clean(row['Status']) || 'Active',
      job_termination_type: clean(row['Job Termination Type']),
      termination_date: clean(row['Termination Date']),
      gross_salary: cleanNumber(row['Gross Salary']),
      phone: clean(row['Phone No']),
      whatsapp: clean(row['Whatsapp No']),
      national_id: clean(row['National Id']),
      birth_certificate: clean(row['Birth Certificate']),
      bank_account: clean(row['Bank Account']),
      bank_account_no: clean(row['Bank Account No']),
      routing_number: clean(row['Routing Number']),
      blood_group: clean(row['Blood Group']),
      gender: clean(row['Gender']),
      religion: clean(row['Religion']),
      job_type: clean(row['Job Type']),
      birth_date: clean(row['Birth Date']),
      payment_mode: clean(row['Payment Mode']),
      email: clean(row['Email Address']),
      number_of_child: cleanInt(row['Number Of Child']),
      nationality: clean(row['Nationality']),
      weekend: clean(row['Weekend']),
      payroll_type: clean(row['Payroll Type']),
      grade: clean(row['Grade']),
      job_division: clean(row['Job Division']),
      shift_name: clean(row['Shift Name']),
      transport_service: clean(row['Transport Service']),
    });
    imported++;

    // create a login account for this employee if one doesn't exist yet
    if (!findUser.get(employee_code)) {
      insertUser.run(employee_code, full_name, DEFAULT_PASSWORD_HASH);
      usersCreated++;
    }
  }
});

runAll(records);

console.log(`\n✅ সম্পন্ন!`);
console.log(`   ইমপোর্ট হয়েছে : ${imported}`);
console.log(`   বাদ পড়েছে      : ${skipped} (Employee Id বা Name খালি ছিল)`);
console.log(`   নতুন লগইন তৈরি : ${usersCreated}`);
console.log(`\nℹ️  প্রতিটি নতুন কর্মীর ডিফল্ট পাসওয়ার্ড: ${DEFAULT_PASSWORD}`);
console.log(`   (username = Employee Id, যেমন "AF1 0001") — প্রথম লগইনে পাসওয়ার্ড বদলাতে বাধ্য করা হবে।\n`);
