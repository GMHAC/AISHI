# RIZVI FOMS — Enterprise Operations Integrated Production System

এই build-টি `Software instruction.pdf`-এর 96-page specification-কে source-of-truth ধরে প্রস্তুত করা হয়েছে। PDF-এর hierarchy, recurring work model, checklist → evidence → KPI → audit → CAPA flow, real-time synchronization, attendance/punch/payroll, task/workflow, document import এবং role control-এর জন্য একটি unified control-plane রাখা হয়েছে।

## Master coverage
- 18 Corporate Management items
- 91 Main Department master records
- 156 Section master records
- 564 Designation master records
- 52 specialized production/enterprise module definitions
- Department → Section → Designation master hierarchy
- Daily / Weekly / Monthly / Quarterly / Half-Yearly / Annual control cycle
- Smart checklist, evidence, KPI, audit, risk and CAPA lifecycle
- Attendance + GPS punch + weekly working-hour signal
- Salary import + OT reconciliation
- Employee CSV/XLSX import
- Training / complaints / policy document APIs
- JWT RBAC backend + SQLite operational database
- Protected audit-log API + database readiness endpoint
- Native SQLite backup script
- Firebase Hosting configuration
- PWA-ready frontend

## Important production note
এটিকে “পৃথিবীর সবচেয়ে বড়” সফটওয়্যার হিসেবে কোনো বাস্তব benchmark ছাড়াই দাবি করা হচ্ছে না। এটি একটি enterprise-grade foundation/implementation build। Production go-live-এর আগে organization-approved Department→Section→Designation mapping, legal/compliance rules, payroll formulas, biometric machine integration, backup/DR, monitoring, secrets, penetration testing এবং user acceptance testing সম্পন্ন করতে হবে।

## Run backend locally
1. Node.js 18+ install করুন।
2. `cd backend`
3. `npm install`
4. `.env.example` কপি করে `.env` বানান এবং `JWT_SECRET`, admin password, CORS origin পরিবর্তন করুন।
5. `node scripts/seed_admin.js`
6. `npm start`
7. Browser: `http://localhost:3000`

## Firebase Hosting
Root directory-তে Firebase CLI চালিয়ে:
- `firebase login`
- `firebase use gen-lang-client-0506048076`
- `firebase deploy --only hosting`

Firebase frontend-টি backend ছাড়া local/offline UI চালাতে পারে, কিন্তু shared enterprise data persistence-এর জন্য authenticated backend/API configure করুন।

## Data import
Employee master: `node backend/scripts/import_employees.js "path/to/employees.csv"`

Web admin endpoint থেকেও CSV/XLSX employee import করা যায়।

## Architecture
Master Data → Transaction → Management System → Performance → Communication → Intelligence

Cross-module lifecycle:
`Master → Work → Checklist → Evidence → KPI → Task → Audit → NC → CAPA → Verification → Dashboard`

## Production endpoints
- `/api/health` — service health
- `/api/ready` — database readiness
- `/api/audit` — admin-only audit log

## Docker
`cd backend && docker compose up -d --build`

## Scale-ready upgrade (27 Aug 2026)
This release now includes a production-oriented document ingestion path under `/api/v2/documents`. Large files are uploaded directly to Google Cloud Storage with short-lived signed URLs and finalized through Pub/Sub, keeping file bytes out of the API server. See `scale/DOCUMENT_INGESTION_ARCHITECTURE_BN.md`.

For the requested 10,000-user / millions-of-documents workload, **do not use the included SQLite/local-upload path as the production datastore**. Use the Cloud Run + Cloud Storage + Pub/Sub + managed PostgreSQL architecture described in `scale/PRODUCTION_SCALING_PLAN_BN.md`. The current legacy routes remain for compatibility and local/pilot operation while the production data layer is migrated.

## GitHub + Firebase setup
See `GITHUB_FIREBASE_SETUP_BN.md` for the exact Windows/GitHub/Firebase sequence.

## Final verification
See `FINAL_CHECK_REPORT_2026-08-27.md`.

## LIVE AQUARIUM COMMAND CENTER
The build now includes a self-contained animated dashboard route (`liveDashboard`) with a waterfall/fountain scene, hundreds of colorful moving fish, bubble-based update effects, rotating flower status messages, six visual themes, 10/15-minute cycle controls, pause/next controls, and browser Bengali speech synthesis. Voice playback is user-initiated because mobile browsers commonly block unsolicited audio. The animation is local canvas/CSS/JS and does not depend on external image assets.
