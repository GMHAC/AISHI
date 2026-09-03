# Storage and processing contract.
# Production flow:
# 1. Authorize user server-side.
# 2. Generate short-lived upload URL or stream through application gateway.
# 3. Store object outside the database; database stores metadata/checksum only.
# 4. Queue antivirus scan.
# 5. For voice/video optionally queue transcription/transcoding/thumbnail jobs.
# 6. Do not expose private object keys directly; authorize every download.
# 7. Record upload/download/delete events in audit/outbox infrastructure.
