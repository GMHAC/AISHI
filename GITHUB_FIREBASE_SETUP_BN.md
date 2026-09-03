# RIZVI FOMS — GitHub + Firebase Hosting Setup (বাংলা)

এই ফাইলটি GitHub repository তৈরি করে Firebase Hosting-এ frontend publish করার জন্য।

## 1) GitHub repository

1. GitHub-এ নতুন **private repository** তৈরি করুন।
2. ZIP extract করে repository root-এ সব ফাইল রাখুন।
3. Git Bash/CMD খুলে repository folder-এ যান।
4. চালান:

```bash
git init
git add .
git commit -m "RIZVI FOMS enterprise final checked build"
git branch -M main
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git
git push -u origin main
```

`YOUR-ACCOUNT` এবং `YOUR-REPOSITORY` নিজের GitHub তথ্য দিয়ে বদলাবেন।

## 2) Firebase project

এই build-এর configured Firebase project:

`gen-lang-client-0506048076`

Firebase Console-এ project খুলে Authentication/Firestore/Hosting প্রয়োজন অনুযায়ী enable করুন।

## 3) Firebase CLI (Windows)

Node.js 20+ ইনস্টল করার পর:

```bash
npm install -g firebase-tools
firebase login
firebase projects:list
firebase use gen-lang-client-0506048076
firebase deploy --only hosting
```

## 4) প্রথমবার deploy

Repository root-এ থেকেই:

```bash
firebase deploy --only hosting --project gen-lang-client-0506048076
```

## 5) GitHub থেকে automatic deploy

Repository → **Settings → Secrets and variables → Actions** → New repository secret:

**Name:** `FIREBASE_SERVICE_ACCOUNT`

**Value:** Firebase/Google Cloud-এর জন্য তৈরি করা deployment service-account JSON-এর সম্পূর্ণ content।

এই secret কখনো source code, `.env`, ZIP-এর ভিতর বা public chat-এ রাখবেন না।

এরপর `main` branch-এ push হলেই `.github/workflows/firebase-hosting.yml` frontend deploy করবে।

## 6) Backend সম্পর্কে গুরুত্বপূর্ণ

Firebase Hosting শুধু frontend publish করে। এই enterprise system-এর shared production backend-এর জন্য আলাদা backend infrastructure প্রয়োজন। বর্তমান package-এ backend, Docker এবং scale architecture আলাদা রাখা হয়েছে।

Production scale target:

- Stateless API
- Managed PostgreSQL/Cloud SQL
- Cloud Storage for documents
- Queue/worker architecture for massive document processing
- Authentication + RBAC
- Monitoring/logging
- Backup + disaster recovery
- Load/UAT testing

**SQLite/local uploads-কে 10,000-user production database বা million-document production storage হিসেবে ব্যবহার করবেন না।**

## 7) Firebase Web Config

`firebase-config.js`-এর web configuration browser-এ থাকা স্বাভাবিক; এটি service-account private key নয়। তবে Firestore/Storage rules এবং Authentication দিয়ে data access অবশ্যই secure করতে হবে।

## 8) Go-Live order

`GitHub → Firebase Hosting → Backend → PostgreSQL → Object Storage → Queue/Workers → Auth/RBAC → Real employee data → Biometric integration → Payroll → KPI → UAT → Load test → Production`

## 9) Security checklist

- Production `.env` commit করবেন না
- Service-account JSON commit করবেন না
- Strong unique JWT secret ব্যবহার করুন
- CORS production domain-এ সীমাবদ্ধ করুন
- Firestore/Storage rules review করুন
- Admin MFA/strong authentication ব্যবহার করুন
- Database backup ও restore test করুন
- Production logs/monitoring চালু করুন
