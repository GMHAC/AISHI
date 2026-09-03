# Phase 6 — Document / Voice / Video

## Implemented
- Unified media-asset metadata
- Document, voice, video, image and other file classification
- Object-storage key model (binary content is not stored in PostgreSQL)
- SHA-256 integrity checksum
- File-size validation
- Asset version history
- Links from media to workflow/audit/CAPA/other entities
- Processing-job queue for antivirus scan, transcription, transcoding, thumbnail and OCR
- Media access log
- Database indexes for scope, owner and job processing

## Production security flow
Authorization → upload → integrity metadata → antivirus queue → optional media processing → controlled access → audit event.

Actual object storage, antivirus engine, transcription service and video-conference provider credentials must be configured in the production environment; they are not fabricated into this package.
