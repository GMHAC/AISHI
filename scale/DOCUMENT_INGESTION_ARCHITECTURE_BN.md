# RIZVI FOMS — Massive Document / 10,000 User Architecture

## লক্ষ্য
দৈনিক লক্ষ লক্ষ document এবং 10,000 concurrent/active users-এর জন্য browser/app থেকে file bytes application server-এর মধ্য দিয়ে না পাঠিয়ে সরাসরি Cloud Storage-এ পাঠানো হবে।

## Upload flow
1. User Android / iPhone / Windows browser থেকে file নির্বাচন করে।
2. `/api/v2/documents/initiate` একটি short-lived signed PUT URL দেয়।
3. Client সরাসরি Cloud Storage-এ file upload করে; network failure হলে resumable/chunked client flow ব্যবহার করা যাবে।
4. `/api/v2/documents/complete` upload verify করে।
5. Pub/Sub-এ `DOCUMENT_INGEST` event যায়।
6. Worker antivirus/type validation, checksum verification, OCR/text extraction, thumbnail/preview, metadata indexing এবং business-module routing করবে।
7. Dashboard-এ job status: QUEUED → PROCESSING → INDEXED / REJECTED / FAILED_RETRY।

## গুরুত্বপূর্ণ production rule
- Local disk `/uploads` production document store নয়।
- SQLite production shared database নয়।
- Large files Express memory-তে নেওয়া যাবে না।
- Production relational HR/payroll data PostgreSQL/Cloud SQL-এ নেওয়া উচিত।
- Documents object storage-এ থাকবে; metadata/index আলাদা scalable store-এ থাকবে।
- Pub/Sub worker pool asynchronous processing করবে।
- Cloud Run API stateless থাকবে যাতে horizontal scaling সম্ভব হয়।

## Supported client classes
- Android Chrome / PWA
- iPhone Safari / PWA
- Windows Chrome / Edge / Firefox
- macOS Safari / Chrome
- Tablet browsers

## Security
- HTTPS only
- short-lived signed upload URLs
- JWT/Firebase/enterprise identity token
- RBAC + department/section scope
- checksum
- MIME/type validation
- malware scanning worker
- audit event for initiate/complete/process/reject
- no service-account key in frontend

## Data lifecycle
UPLOAD → VERIFY → QUARANTINE → SCAN → EXTRACT → INDEX → LINK TO RECORD → RETENTION → ARCHIVE/DELETE
