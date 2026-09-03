# RIZVI FOMS — FULL & FINAL BUILD
## Target
`rfims-s.web.app`

এই package-টি RIZVI FOMS-এর সর্বশেষ MASTER SIDEBAR/Operational requirements অনুযায়ী তৈরি করা unified web build।
Main navigation 45টি item, Section navigation, Designation Master, Section 39 Task & Workflow, Smart Checklist, KPI/Reports/Audit concepts এবং API-ready synchronization hooks রাখা হয়েছে।

### গুরুত্বপূর্ণ
- Firebase Hosting এই package-এর frontend publish করবে।
- Cross-user real-time data-এর জন্য Firebase Authentication + Firestore Rules অথবা bundled Node API backend deploy/configure করতে হবে।
- এই ZIP নিজে থেকে Firebase-এ publish হয়ে যায় না।
- Production-এ permissive rules, demo credentials বা client-side privilege-এর উপর নির্ভর করবেন না।

## Firebase deploy
1. Node.js + Firebase CLI install করুন।
2. এই folder-এ terminal খুলুন।
3. `firebase login`
4. `firebase use gen-lang-client-0506048076`
5. `firebase deploy --only hosting`
6. Hosting URL: `https://rfims-s.web.app`

Firestore চালু করতে চাইলে:
- Firebase Console → Authentication → provider configure করুন।
- Firestore Database তৈরি করুন।
- `firebase deploy --only firestore:rules,firestore:indexes`
- Admin account/roles configure করুন।

## API mode
`backend/` bundled আছে। Internet-wide production deployment-এর জন্য Node/Express backend, persistent database, object storage, rate limiting, backup, monitoring এবং server-side RBAC প্রয়োজন।
Frontend Settings থেকে API base configure করা যায়।

## Functional hierarchy
Main Sidebar = organization manages
Section Sidebar = where work happens
Designation Sidebar = who is responsible
Task & Workflow = what action must be done
Checklist = how work is verified
KPI = how performance is measured
Document = evidence
Audit Trail = who did what and when
Real-Time Sync = authorized users see latest state

## Source preservation
`legacy_sources/`-এ আগের uploaded builds রাখা হয়েছে যাতে কোনো পুরোনো module/source হারিয়ে না যায়।
