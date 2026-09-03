-- Phase 6: Document / Voice / Video
CREATE TABLE IF NOT EXISTS media_asset (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_employee_id BIGINT REFERENCES employee(id),
 scope_type VARCHAR(30) NOT NULL,
 scope_id TEXT,
 asset_type VARCHAR(30) NOT NULL CHECK(asset_type IN ('DOCUMENT','VOICE','VIDEO','IMAGE','OTHER')),
 original_filename TEXT NOT NULL,
 object_key TEXT NOT NULL UNIQUE,
 media_type VARCHAR(150),
 size_bytes BIGINT NOT NULL CHECK(size_bytes>=0),
 sha256 CHAR(64) NOT NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'UPLOADED',
 uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 deleted_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS media_version (
 id BIGSERIAL PRIMARY KEY,
 asset_id UUID NOT NULL REFERENCES media_asset(id) ON DELETE CASCADE,
 version_no INT NOT NULL,
 object_key TEXT NOT NULL,
 sha256 CHAR(64) NOT NULL,
 created_by BIGINT REFERENCES employee(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(asset_id,version_no)
);
CREATE TABLE IF NOT EXISTS media_link (
 id BIGSERIAL PRIMARY KEY,
 asset_id UUID NOT NULL REFERENCES media_asset(id) ON DELETE CASCADE,
 entity_type VARCHAR(100) NOT NULL,
 entity_id TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(asset_id,entity_type,entity_id)
);
CREATE TABLE IF NOT EXISTS media_processing_job (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 asset_id UUID NOT NULL REFERENCES media_asset(id) ON DELETE CASCADE,
 job_type VARCHAR(50) NOT NULL CHECK(job_type IN ('ANTIVIRUS_SCAN','TRANSCODE','THUMBNAIL','TRANSCRIPTION','OCR')),
 status VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
 result JSONB NOT NULL DEFAULT '{}'::jsonb,
 queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 completed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS media_access_log (
 id BIGSERIAL PRIMARY KEY,
 asset_id UUID NOT NULL REFERENCES media_asset(id),
 employee_id BIGINT REFERENCES employee(id),
 action VARCHAR(50) NOT NULL,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 source_ip INET
);
CREATE INDEX IF NOT EXISTS idx_media_scope ON media_asset(scope_type,scope_id,status);
CREATE INDEX IF NOT EXISTS idx_media_owner ON media_asset(owner_employee_id,uploaded_at);
CREATE INDEX IF NOT EXISTS idx_media_job_status ON media_processing_job(status,queued_at);
