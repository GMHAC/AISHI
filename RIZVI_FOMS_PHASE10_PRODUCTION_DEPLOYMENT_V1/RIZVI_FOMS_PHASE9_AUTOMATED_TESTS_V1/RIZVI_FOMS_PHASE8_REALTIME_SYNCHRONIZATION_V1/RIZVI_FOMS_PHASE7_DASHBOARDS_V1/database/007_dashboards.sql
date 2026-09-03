-- Phase 7: Section, Department & Management Dashboards
CREATE TABLE IF NOT EXISTS dashboard_snapshot (
 id BIGSERIAL PRIMARY KEY,
 dashboard_type VARCHAR(30) NOT NULL CHECK(dashboard_type IN ('SECTION','DEPARTMENT','MANAGEMENT')),
 scope_id TEXT,
 snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
 generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dashboard_alert (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 dashboard_type VARCHAR(30) NOT NULL,
 scope_type VARCHAR(30),
 scope_id TEXT,
 severity VARCHAR(20) NOT NULL CHECK(severity IN ('INFO','WARNING','CRITICAL')),
 title TEXT NOT NULL,
 message TEXT,
 status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
 source_type VARCHAR(100),
 source_id TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 acknowledged_at TIMESTAMPTZ,
 acknowledged_by BIGINT REFERENCES employee(id)
);
CREATE TABLE IF NOT EXISTS management_message (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 title TEXT NOT NULL,
 body TEXT NOT NULL,
 priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
 attachment_asset_id UUID REFERENCES media_asset(id),
 created_by BIGINT REFERENCES employee(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS message_delivery (
 id BIGSERIAL PRIMARY KEY,
 message_id UUID NOT NULL REFERENCES management_message(id) ON DELETE CASCADE,
 employee_id BIGINT NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
 delivered_at TIMESTAMPTZ,
 read_at TIMESTAMPTZ,
 UNIQUE(message_id,employee_id)
);
CREATE INDEX IF NOT EXISTS idx_dashboard_snapshot_scope ON dashboard_snapshot(dashboard_type,scope_id,generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_alert_scope ON dashboard_alert(status,severity,scope_type,scope_id);
