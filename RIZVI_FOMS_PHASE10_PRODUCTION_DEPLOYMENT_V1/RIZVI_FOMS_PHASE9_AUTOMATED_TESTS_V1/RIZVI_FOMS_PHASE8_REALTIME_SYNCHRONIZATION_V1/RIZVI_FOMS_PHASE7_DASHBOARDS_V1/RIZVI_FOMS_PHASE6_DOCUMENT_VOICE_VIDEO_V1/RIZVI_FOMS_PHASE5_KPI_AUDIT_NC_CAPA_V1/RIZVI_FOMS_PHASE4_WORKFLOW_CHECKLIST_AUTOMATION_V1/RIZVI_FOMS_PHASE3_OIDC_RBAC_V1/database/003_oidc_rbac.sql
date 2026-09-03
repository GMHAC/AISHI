-- Phase 3: OAuth/OIDC identity + server-side RBAC
CREATE TABLE IF NOT EXISTS role (id BIGSERIAL PRIMARY KEY, code VARCHAR(100) UNIQUE NOT NULL, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS permission (id BIGSERIAL PRIMARY KEY, module VARCHAR(100) NOT NULL, action VARCHAR(50) NOT NULL, UNIQUE(module,action));
CREATE TABLE IF NOT EXISTS employee_role (employee_id BIGINT NOT NULL REFERENCES employee(id) ON DELETE CASCADE, role_id BIGINT NOT NULL REFERENCES role(id) ON DELETE CASCADE, PRIMARY KEY(employee_id,role_id));
CREATE TABLE IF NOT EXISTS role_permission (role_id BIGINT NOT NULL REFERENCES role(id) ON DELETE CASCADE, permission_id BIGINT NOT NULL REFERENCES permission(id) ON DELETE CASCADE, PRIMARY KEY(role_id,permission_id));
INSERT INTO role(code,name) VALUES ('MAIN_ADMIN','Main Admin'),('MANAGEMENT','Management / Director'),('DEPARTMENT_ADMIN','Department Admin'),('SECTION_ADMIN','Section Admin'),('EMPLOYEE','Employee') ON CONFLICT (code) DO NOTHING;
