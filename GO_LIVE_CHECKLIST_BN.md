# RIZVI FOMS — বাস্তব ব্যবহার শুরু করার Final Checklist

## 1) প্রথমবার server চালু
```bash
cd backend
npm install
cp .env.production.example .env
# .env-এ বাস্তব secret/password/domain বসান
npm run seed-admin
npm start
```

Windows PowerShell-এ `cp` কাজ না করলে `.env.production.example` কপি করে `.env` নামে রাখুন।

## 2) প্রথম login
- Seed করা admin code/password দিয়ে login করুন।
- প্রথম login-এর পর password পরিবর্তন করুন।
- Example/default password production-এ ব্যবহার করবেন না।

## 3) Employee Master
- Approved HR CSV/XLSX export প্রস্তুত করুন।
- Employee Code/Card No duplicate আছে কি না পরীক্ষা করুন।
- Import করুন।
- Active/Resigned/Left status যাচাই করুন।
- Department, Section, Designation mapping যাচাই করুন।

## 4) Attendance
- প্রথমে একটি test employee দিয়ে manual/GPS punch পরীক্ষা করুন।
- তারপর বাস্তব biometric machine integration আলাদাভাবে test করুন।
- In/Out pair, break, net hours, OT এবং weekly total মিলিয়ে দেখুন।

## 5) Salary
- মাসের salary sheet import করুন।
- Attendance OT বনাম Salary OT reconciliation চালান।
- REVIEW rows management approval ছাড়া payroll final করবেন না।

## 6) KPI / Performance
- প্রতিটি designation-এর approved checklist template দিন।
- Yes / No / Partial response policy নিশ্চিত করুন।
- Partial-এর কারণ/evidence সংরক্ষণ করুন।
- Daily → Weekly → Monthly → Quarterly → Half-Yearly → Annual review calendar approve করুন।

## 7) Documents / Complaints / Training
- Policy documents upload করুন।
- Training records import করুন।
- Complaint/Suggestion workflow-এ responsible owner ও resolution rule দিন।

## 8) Security
- HTTPS ছাড়া production login চালাবেন না।
- Strong JWT secret ব্যবহার করুন।
- Firebase authorized domain ঠিক করুন।
- Admin account share করবেন না।
- Backup schedule ও restore test চালু করুন।
- Audit log নিয়মিত review করুন।

## 9) Backup
```bash
cd backend
npm run backup
```
Backup folder অবশ্যই আলাদা persistent storage-এ কপি/সিঙ্ক করতে হবে।

## 10) Health checks
- `/api/health`
- `/api/ready`

## 11) Final acceptance
Production sign-off-এর আগে HR, Admin, Compliance, Finance/Payroll এবং Management প্রত্যেকে তাদের own workflow UAT sign-off করবেন।

## বাস্তব সীমা
এই software package-এর মধ্যে external biometric hardware, telecom GSM triangulation, bank payroll gateway, WhatsApp Business API বা অজানা third-party ERP-এর credentials/contract/API স্বয়ংক্রিয়ভাবে তৈরি করা সম্ভব নয়। এগুলোর official API/device documentation ও credentials পাওয়ার পর integration সম্পন্ন করতে হবে।
