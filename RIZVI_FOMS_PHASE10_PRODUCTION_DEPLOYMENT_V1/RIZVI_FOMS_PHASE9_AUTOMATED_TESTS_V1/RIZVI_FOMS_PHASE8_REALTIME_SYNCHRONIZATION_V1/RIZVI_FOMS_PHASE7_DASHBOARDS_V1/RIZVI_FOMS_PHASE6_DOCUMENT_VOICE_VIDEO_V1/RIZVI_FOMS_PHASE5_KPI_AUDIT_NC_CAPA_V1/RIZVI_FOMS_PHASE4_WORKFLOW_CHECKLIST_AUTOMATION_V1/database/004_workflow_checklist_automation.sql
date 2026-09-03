-- Phase 4: Workflow, Checklist & Automation
CREATE TABLE IF NOT EXISTS workflow_template (
 id BIGSERIAL PRIMARY KEY,
 code VARCHAR(100) UNIQUE NOT NULL,
 name TEXT NOT NULL,
 frequency VARCHAR(30) NOT NULL CHECK (frequency IN ('HOURLY','DAILY','WEEKLY','MONTHLY','QUARTERLY','HALF_YEARLY','ANNUAL','AD_HOC')),
 scope_type VARCHAR(30) NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS workflow_template_step (
 id BIGSERIAL PRIMARY KEY,
 template_id BIGINT NOT NULL REFERENCES workflow_template(id) ON DELETE CASCADE,
 step_no INT NOT NULL,
 name TEXT NOT NULL,
 required BOOLEAN NOT NULL DEFAULT TRUE,
 UNIQUE(template_id,step_no)
);
CREATE TABLE IF NOT EXISTS work_item (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 template_id BIGINT REFERENCES workflow_template(id),
 title TEXT NOT NULL,
 frequency VARCHAR(30) NOT NULL,
 department_id BIGINT REFERENCES organization_department(id),
 section_id BIGINT REFERENCES organization_section(id),
 designation_id BIGINT REFERENCES organization_designation(id),
 employee_id BIGINT REFERENCES employee(id),
 status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','IN_PROGRESS','SUBMITTED','APPROVED','REJECTED','OVERDUE','CANCELLED')),
 scheduled_for TIMESTAMPTZ NOT NULL,
 due_at TIMESTAMPTZ,
 completed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS work_checklist_item (
 id BIGSERIAL PRIMARY KEY,
 work_item_id UUID NOT NULL REFERENCES work_item(id) ON DELETE CASCADE,
 item_no INT NOT NULL,
 requirement TEXT NOT NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','DONE','NOT_APPLICABLE','FAILED')),
 evidence_required BOOLEAN NOT NULL DEFAULT FALSE,
 completed_by BIGINT REFERENCES employee(id),
 completed_at TIMESTAMPTZ,
 UNIQUE(work_item_id,item_no)
);
CREATE TABLE IF NOT EXISTS automation_rule (
 id BIGSERIAL PRIMARY KEY,
 name TEXT NOT NULL,
 trigger_type VARCHAR(50) NOT NULL,
 frequency VARCHAR(30),
 target_scope VARCHAR(30),
 enabled BOOLEAN NOT NULL DEFAULT TRUE,
 config JSONB NOT NULL DEFAULT '{}'::jsonb,
 last_run_at TIMESTAMPTZ,
 next_run_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS workflow_approval (
 id BIGSERIAL PRIMARY KEY,
 work_item_id UUID NOT NULL REFERENCES work_item(id) ON DELETE CASCADE,
 sequence_no INT NOT NULL,
 approver_employee_id BIGINT REFERENCES employee(id),
 status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
 decision_note TEXT,
 decided_at TIMESTAMPTZ,
 UNIQUE(work_item_id,sequence_no)
);
CREATE TABLE IF NOT EXISTS escalation_rule (
 id BIGSERIAL PRIMARY KEY,
 name TEXT NOT NULL,
 after_minutes INT NOT NULL CHECK(after_minutes>0),
 action VARCHAR(50) NOT NULL,
 enabled BOOLEAN NOT NULL DEFAULT TRUE,
 config JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_work_item_schedule ON work_item(status,scheduled_for,due_at);
CREATE INDEX IF NOT EXISTS idx_work_scope ON work_item(department_id,section_id,employee_id);
