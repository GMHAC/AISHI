-- Phase 8: Real-time synchronization
CREATE TABLE IF NOT EXISTS event_outbox (
 id BIGSERIAL PRIMARY KEY,
 event_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 aggregate_type VARCHAR(100) NOT NULL,
 aggregate_id TEXT NOT NULL,
 event_type VARCHAR(150) NOT NULL,
 payload JSONB NOT NULL DEFAULT '{}'::jsonb,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 published_at TIMESTAMPTZ,
 publish_attempts INT NOT NULL DEFAULT 0,
 status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
   CHECK(status IN ('PENDING','PROCESSING','PUBLISHED','FAILED','DEAD_LETTER'))
);
CREATE TABLE IF NOT EXISTS event_inbox (
 id BIGSERIAL PRIMARY KEY,
 consumer_name VARCHAR(150) NOT NULL,
 event_id UUID NOT NULL,
 received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 processed_at TIMESTAMPTZ,
 status VARCHAR(30) NOT NULL DEFAULT 'RECEIVED'
   CHECK(status IN ('RECEIVED','PROCESSED','FAILED')),
 error_message TEXT,
 UNIQUE(consumer_name,event_id)
);
CREATE TABLE IF NOT EXISTS sync_subscription (
 id BIGSERIAL PRIMARY KEY,
 client_id VARCHAR(255) NOT NULL,
 employee_id BIGINT REFERENCES employee(id),
 channel VARCHAR(150) NOT NULL,
 scope_type VARCHAR(50),
 scope_id TEXT,
 connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sync_cursor (
 consumer_name VARCHAR(150) PRIMARY KEY,
 last_event_id UUID,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON event_outbox(status,occurred_at);
CREATE INDEX IF NOT EXISTS idx_outbox_aggregate ON event_outbox(aggregate_type,aggregate_id,occurred_at);
CREATE INDEX IF NOT EXISTS idx_inbox_consumer ON event_inbox(consumer_name,status,received_at);
