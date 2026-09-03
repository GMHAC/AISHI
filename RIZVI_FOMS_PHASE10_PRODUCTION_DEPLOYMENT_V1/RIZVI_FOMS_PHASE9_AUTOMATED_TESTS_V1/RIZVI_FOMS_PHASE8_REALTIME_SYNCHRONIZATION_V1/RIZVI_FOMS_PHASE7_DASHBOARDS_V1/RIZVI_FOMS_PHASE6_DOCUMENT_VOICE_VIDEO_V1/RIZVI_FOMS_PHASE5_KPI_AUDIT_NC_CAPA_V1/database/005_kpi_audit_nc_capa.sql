-- Phase 5: KPI, Audit, Nonconformity and CAPA
CREATE TABLE IF NOT EXISTS kpi_definition (
 id BIGSERIAL PRIMARY KEY,
 code VARCHAR(100) UNIQUE NOT NULL,
 name TEXT NOT NULL,
 description TEXT,
 frequency VARCHAR(30) NOT NULL,
 target_value NUMERIC(18,4),
 target_operator VARCHAR(10) NOT NULL DEFAULT '>=',
 formula TEXT,
 owner_scope VARCHAR(30),
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS kpi_measurement (
 id BIGSERIAL PRIMARY KEY,
 kpi_id BIGINT NOT NULL REFERENCES kpi_definition(id),
 period_start DATE NOT NULL,
 period_end DATE NOT NULL,
 actual_value NUMERIC(18,4) NOT NULL,
 source_reference TEXT,
 measured_by BIGINT REFERENCES employee(id),
 measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(kpi_id,period_start,period_end)
);
CREATE TABLE IF NOT EXISTS audit_program (
 id BIGSERIAL PRIMARY KEY, code VARCHAR(100) UNIQUE NOT NULL,
 name TEXT NOT NULL, audit_type VARCHAR(50) NOT NULL,
 planned_start TIMESTAMPTZ, planned_end TIMESTAMPTZ,
 status VARCHAR(30) NOT NULL DEFAULT 'PLANNED'
);
CREATE TABLE IF NOT EXISTS audit_finding (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 audit_id BIGINT NOT NULL REFERENCES audit_program(id) ON DELETE CASCADE,
 finding_no VARCHAR(100) UNIQUE NOT NULL,
 classification VARCHAR(30) NOT NULL CHECK(classification IN ('OBSERVATION','MINOR_NC','MAJOR_NC','OPPORTUNITY')),
 requirement_reference TEXT,
 description TEXT NOT NULL,
 evidence_reference TEXT,
 owner_employee_id BIGINT REFERENCES employee(id),
 status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
 raised_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS nonconformity (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 nc_no VARCHAR(100) UNIQUE NOT NULL,
 source VARCHAR(50) NOT NULL,
 severity VARCHAR(30) NOT NULL DEFAULT 'MINOR',
 requirement_reference TEXT,
 description TEXT NOT NULL,
 containment_action TEXT,
 status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
 owner_employee_id BIGINT REFERENCES employee(id),
 opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 closed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS capa (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 capa_no VARCHAR(100) UNIQUE NOT NULL,
 nc_id UUID REFERENCES nonconformity(id),
 title TEXT NOT NULL,
 root_cause_method VARCHAR(50),
 root_cause TEXT,
 corrective_action TEXT,
 preventive_action TEXT,
 owner_employee_id BIGINT REFERENCES employee(id),
 due_at TIMESTAMPTZ,
 status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','INVESTIGATION','ACTION','IMPLEMENTED','EFFECTIVENESS_REVIEW','CLOSED','REJECTED')),
 effectiveness_result TEXT,
 verified_by BIGINT REFERENCES employee(id),
 verified_at TIMESTAMPTZ,
 closed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS capa_action (
 id BIGSERIAL PRIMARY KEY,
 capa_id UUID NOT NULL REFERENCES capa(id) ON DELETE CASCADE,
 action_no INT NOT NULL,
 action_type VARCHAR(30) NOT NULL CHECK(action_type IN ('CONTAINMENT','CORRECTIVE','PREVENTIVE')),
 description TEXT NOT NULL,
 owner_employee_id BIGINT REFERENCES employee(id),
 due_at TIMESTAMPTZ,
 completed_at TIMESTAMPTZ,
 status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
 evidence_reference TEXT,
 UNIQUE(capa_id,action_no)
);
CREATE TABLE IF NOT EXISTS audit_trace (
 id BIGSERIAL PRIMARY KEY,
 entity_type VARCHAR(100) NOT NULL,
 entity_id TEXT NOT NULL,
 action VARCHAR(100) NOT NULL,
 actor_employee_id BIGINT REFERENCES employee(id),
 previous_state JSONB,
 new_state JSONB,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kpi_measurement_period ON kpi_measurement(kpi_id,period_start,period_end);
CREATE INDEX IF NOT EXISTS idx_finding_status ON audit_finding(status,raised_at);
CREATE INDEX IF NOT EXISTS idx_nc_status ON nonconformity(status,opened_at);
CREATE INDEX IF NOT EXISTS idx_capa_status_due ON capa(status,due_at);
