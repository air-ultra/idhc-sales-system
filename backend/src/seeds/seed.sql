-- =============================================
-- DEPARTMENTS
-- =============================================
INSERT INTO departments (name, code) VALUES
  ('Sales', 'SALES'),
  ('Support', 'SUPPORT'),
  ('Account', 'ACCOUNT'),
  ('Management', 'MGMT')
ON CONFLICT (code) DO NOTHING;

-- =============================================
-- ROLES
-- =============================================
INSERT INTO roles (name, code, description) VALUES
  ('Administrator', 'admin', 'Full system access'),
  ('General Manager', 'gm', 'Management level access'),
  ('Sales Manager', 'sales_mgr', 'Sales team manager'),
  ('Sales Staff', 'sales_staff', 'Sales team member'),
  ('Support Staff', 'support_staff', 'Support team member'),
  ('Account Staff', 'account_staff', 'Accounting team member')
ON CONFLICT (code) DO NOTHING;

-- =============================================
-- PERMISSIONS
-- =============================================
DO $$
DECLARE
  mod TEXT;
  act TEXT;
  modules TEXT[] := ARRAY['dashboard','staff','user','role','quotation','sales_order','stock','purchase_order','invoice','payment','maintenance','job_support','report'];
  actions TEXT[] := ARRAY['view','create','edit','delete','approve','export'];
BEGIN
  FOREACH mod IN ARRAY modules LOOP
    FOREACH act IN ARRAY actions LOOP
      INSERT INTO permissions (module, action, description)
      VALUES (mod, act, act || ' ' || mod)
      ON CONFLICT (module, action) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Give admin role ALL permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

-- =============================================
-- DEFAULT ADMIN USER
-- password: admin1234 (bcrypt hash)
-- =============================================
INSERT INTO staff (employee_code, title_th, first_name_th, last_name_th, first_name_en, last_name_en, position, status)
VALUES ('EMP-000', 'นาย', 'ผู้ดูแล', 'ระบบ', 'System', 'Admin', 'Administrator', 'active')
ON CONFLICT (employee_code) DO NOTHING;

INSERT INTO users (username, email, password_hash, staff_id, role_id, is_active)
VALUES (
  'admin',
  'admin@system.local',
  '$2a$12$GTKr/4is70gt9IpztKDYeu57U6oPf0p7vYBY75KyUAFq9oYWN6acm',
  (SELECT id FROM staff WHERE employee_code = 'EMP-000'),
  (SELECT id FROM roles WHERE code = 'admin'),
  true
)
ON CONFLICT (username) DO NOTHING;

-- =============================================
-- SAMPLE STAFF DATA
-- =============================================
INSERT INTO staff (employee_code, title_th, first_name_th, last_name_th, nickname_th, first_name_en, last_name_en, nickname_en, department_id, position, hire_date, status) VALUES
  ('EMP-001', 'นาย', 'สมชาย', 'ใจดี', 'ชาย', 'Somchai', 'Jaidee', 'Chai', (SELECT id FROM departments WHERE code='SALES'), 'Sales Manager', '2023-01-15', 'active'),
  ('EMP-002', 'นางสาว', 'สมหญิง', 'รักดี', 'หญิง', 'Somying', 'Rakdee', 'Ying', (SELECT id FROM departments WHERE code='SALES'), 'Sales Executive', '2023-03-01', 'active'),
  ('EMP-003', 'นาย', 'วิชัย', 'สุขสันต์', 'ชัย', 'Wichai', 'Suksan', 'Chai', (SELECT id FROM departments WHERE code='SUPPORT'), 'Support Lead', '2023-02-10', 'active'),
  ('EMP-004', 'นางสาว', 'พรทิพย์', 'แสงจันทร์', 'ทิพย์', 'Porntip', 'Sangjan', 'Tip', (SELECT id FROM departments WHERE code='ACCOUNT'), 'Accountant', '2023-04-01', 'active'),
  ('EMP-005', 'นาย', 'ประเสริฐ', 'มั่นคง', 'เสริฐ', 'Prasert', 'Munkong', 'Sert', (SELECT id FROM departments WHERE code='MGMT'), 'General Manager', '2022-06-01', 'active')
ON CONFLICT (employee_code) DO NOTHING;
