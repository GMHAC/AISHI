-- Production transactional core (starter schema). Apply through a migration tool.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code varchar(50) UNIQUE NOT NULL,
  name varchar(200) NOT NULL,
  role varchar(50) NOT NULL DEFAULT 'employee',
  auth_provider_uid varchar(200) UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code varchar(50) UNIQUE NOT NULL,
  punched_id varchar(50),
  full_name varchar(200) NOT NULL,
  name_bn varchar(200),
  join_date date,
  corporate varchar(200),
  department varchar(200),
  section varchar(200),
  designation varchar(200),
  status varchar(30) NOT NULL DEFAULT 'Active',
  gross_salary numeric(14,2),
  phone varchar(30),
  email varchar(200),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_emp_department_status ON employees(department,status);
CREATE INDEX IF NOT EXISTS idx_emp_section_designation ON employees(section,designation);
CREATE TABLE IF NOT EXISTS attendance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id),
  event_time timestamptz NOT NULL,
  event_type varchar(20) NOT NULL,
  source varchar(40) NOT NULL,
  device_id varchar(200),
  latitude numeric(10,7), longitude numeric(10,7), accuracy numeric(10,2),
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_att_employee_time ON attendance_events(employee_id,event_time DESC);
CREATE TABLE IF NOT EXISTS document_jobs (
  id uuid PRIMARY KEY,
  object_name text NOT NULL,
  bucket text NOT NULL,
  file_name text NOT NULL,
  content_type varchar(200),
  size_bytes bigint NOT NULL,
  sha256 char(64),
  module varchar(100),
  department varchar(200),
  section varchar(200),
  designation varchar(200),
  status varchar(30) NOT NULL DEFAULT 'QUEUED',
  uploaded_by uuid,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_document_jobs_status_created ON document_jobs(status,created_at);
CREATE INDEX IF NOT EXISTS idx_document_jobs_scope ON document_jobs(department,section,designation);
