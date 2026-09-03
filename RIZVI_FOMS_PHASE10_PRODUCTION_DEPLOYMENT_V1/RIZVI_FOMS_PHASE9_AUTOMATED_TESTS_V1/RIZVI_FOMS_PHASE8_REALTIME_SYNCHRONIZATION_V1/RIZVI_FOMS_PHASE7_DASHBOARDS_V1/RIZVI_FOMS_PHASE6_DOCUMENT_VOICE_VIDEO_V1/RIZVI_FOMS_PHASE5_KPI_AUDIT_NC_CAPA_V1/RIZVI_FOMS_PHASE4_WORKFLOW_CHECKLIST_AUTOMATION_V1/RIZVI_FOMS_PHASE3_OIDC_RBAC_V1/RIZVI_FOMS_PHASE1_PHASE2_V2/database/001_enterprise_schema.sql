-- RIZVI FOMS Phase 2 PostgreSQL Enterprise Database
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE organization_corporate (
 id BIGSERIAL PRIMARY KEY, master_no INT UNIQUE NOT NULL, name TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE organization_department (
 id BIGSERIAL PRIMARY KEY, master_no INT UNIQUE NOT NULL, name TEXT NOT NULL, purpose TEXT, active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE organization_section (
 id BIGSERIAL PRIMARY KEY, master_no INT UNIQUE NOT NULL, name TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE organization_designation (
 id BIGSERIAL PRIMARY KEY, master_no INT UNIQUE NOT NULL, name TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Controlled approved hierarchy mapping
CREATE TABLE department_section_map (
 id BIGSERIAL PRIMARY KEY,
 department_id BIGINT NOT NULL REFERENCES organization_department(id),
 section_id BIGINT NOT NULL REFERENCES organization_section(id),
 effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
 effective_to DATE,
 approved_by TEXT,
 approved_at TIMESTAMPTZ,
 UNIQUE(department_id, section_id, effective_from)
);
CREATE TABLE section_designation_map (
 id BIGSERIAL PRIMARY KEY,
 section_id BIGINT NOT NULL REFERENCES organization_section(id),
 designation_id BIGINT NOT NULL REFERENCES organization_designation(id),
 effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
 effective_to DATE,
 approved_by TEXT,
 approved_at TIMESTAMPTZ,
 UNIQUE(section_id, designation_id, effective_from)
);

CREATE TABLE employee (
 id BIGSERIAL PRIMARY KEY,
 official_id VARCHAR(100) UNIQUE NOT NULL,
 mobile VARCHAR(30) UNIQUE,
 full_name TEXT NOT NULL,
 department_id BIGINT REFERENCES organization_department(id),
 section_id BIGINT REFERENCES organization_section(id),
 designation_id BIGINT REFERENCES organization_designation(id),
 oidc_subject VARCHAR(255) UNIQUE,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE role (
 id BIGSERIAL PRIMARY KEY, code VARCHAR(100) UNIQUE NOT NULL, name TEXT NOT NULL
);
CREATE TABLE permission (
 id BIGSERIAL PRIMARY KEY, module VARCHAR(100) NOT NULL, action VARCHAR(50) NOT NULL,
 UNIQUE(module, action)
);
CREATE TABLE role_permission (
 role_id BIGINT REFERENCES role(id) ON DELETE CASCADE,
 permission_id BIGINT REFERENCES permission(id) ON DELETE CASCADE,
 PRIMARY KEY(role_id, permission_id)
);
CREATE TABLE employee_role (
 employee_id BIGINT REFERENCES employee(id) ON DELETE CASCADE,
 role_id BIGINT REFERENCES role(id) ON DELETE CASCADE,
 PRIMARY KEY(employee_id, role_id)
);

CREATE TABLE workflow_task (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 title TEXT NOT NULL,
 frequency VARCHAR(30) NOT NULL,
 department_id BIGINT REFERENCES organization_department(id),
 section_id BIGINT REFERENCES organization_section(id),
 designation_id BIGINT REFERENCES organization_designation(id),
 employee_id BIGINT REFERENCES employee(id),
 status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
 due_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE checklist_template (
 id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, version INT NOT NULL DEFAULT 1,
 active BOOLEAN NOT NULL DEFAULT TRUE, UNIQUE(name, version)
);
CREATE TABLE checklist_item (
 id BIGSERIAL PRIMARY KEY, template_id BIGINT NOT NULL REFERENCES checklist_template(id) ON DELETE CASCADE,
 item_no INT NOT NULL, requirement TEXT NOT NULL, UNIQUE(template_id, item_no)
);
CREATE TABLE evidence_record (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 task_id UUID REFERENCES workflow_task(id),
 object_key TEXT NOT NULL, media_type VARCHAR(100), checksum VARCHAR(128),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE kpi_template (
 id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, frequency VARCHAR(30) NOT NULL,
 weight NUMERIC(8,3), formula_version VARCHAR(50), active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE audit_event (
 id BIGSERIAL PRIMARY KEY, event_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
 actor TEXT, action VARCHAR(100) NOT NULL, entity_type VARCHAR(100) NOT NULL,
 entity_id TEXT NOT NULL, payload JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE enterprise_outbox (
 id BIGSERIAL PRIMARY KEY, event_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
 event_type VARCHAR(100) NOT NULL, entity_type VARCHAR(100) NOT NULL, entity_id TEXT NOT NULL,
 actor TEXT, payload JSONB NOT NULL DEFAULT '{}'::jsonb,
 status VARCHAR(30) NOT NULL DEFAULT 'QUEUED', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_scope ON workflow_task(department_id, section_id, designation_id, employee_id);
CREATE INDEX idx_audit_entity ON audit_event(entity_type, entity_id, created_at);
CREATE INDEX idx_outbox_status ON enterprise_outbox(status, created_at);
