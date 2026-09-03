# RIZVI FOMS — Enterprise Final Audit (2026-08-28)

## Source basis
The supplied `Software instruction.pdf` is a 96-page scanned document, so ordinary text extraction is unavailable. The supplied latest `UPDATE URGENT RIZVI FOMS.docx` was parsed and treated as the latest sidebar/specification source.

## Verified source requirements
- Corporate & Strategic Management
- 45 Main Sidebar items and the rule that each item must open Dashboard → Operational Functions → Checklist → Documents → Tasks → KPI → Reports → Audit Trail → Real-Time Synchronization.
- 39 Section Sidebar entries in the latest instruction.
- Designation master registry with responsibility, authority, KPI, competency, training, checklist, workflow, access and permission fields.
- Universal Checklist Engine: ISO, legal/regulatory, buyer, company/SOP, daily/shift/weekly/monthly/periodic, inspection and audit.
- Non-compliance automation: Finding → NC → Severity → Responsible → CAPA → Target → Notification → Verification → Closure.
- Real-time synchronization across attendance, payroll, production, IE, planning, QA and management.
- Marketing & Merchandising flow: Buyer → Inquiry → Costing → Style → Tech Pack → Sample → Order → T&A → Delay → Production Follow-up → Shipment → Feedback → Complaint → CAPA → Rating → KPI.
- ISO management standards are modeled as configurable requirement/reference mappings; copyrighted standard text is not copied into the application.

## Current build corrections
1. Frontend now defaults to `/api`, eliminating the previous empty API-base condition on a same-origin deployment.
2. Firebase Hosting has an `/api/**` Cloud Run rewrite for `rizvi-foms-api`. The Cloud Run service must actually be deployed for live API traffic.
3. Added enterprise operational API for Corporate, Live Tracking, Production, Inventory, Traceability, Procurement, Fabrics, Marketing and ISO event feeds.
4. Added ID Card/Punched ID → Employee → Department → Section → Designation → Responsibility/KPI/Checklist access endpoint.
5. Added normalized enterprise event and responsibility profile tables for local/pilot mode.
6. Added responsive enterprise control UI and module shortcuts.

## Important production boundary
This package is a corrected, testable enterprise foundation. It is NOT a claim that 10,000 concurrent users, millions of documents/day, biometric devices, payroll rules, or disaster recovery have been load-tested in this environment. For that scale, migrate transactional data from SQLite to managed PostgreSQL, documents to object storage, and processing to asynchronous workers/queues before production certification.

## Responsibility data boundary
The source specification defines the fields that must exist for each designation, but it does not provide a complete authorized employee-by-employee responsibility matrix. The software therefore shows `Not configured` until an authorized administrator imports/configures the actual responsibility profile; it does not invent job responsibilities.
