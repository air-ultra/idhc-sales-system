-- ═══════════════════════════════════════════════════════════
-- RESET DATA SCRIPT — Phase B (Keep Users + Roles)
-- ═══════════════════════════════════════════════════════════
-- ⚠️ คำเตือน: SQL นี้จะลบข้อมูลส่วนใหญ่ของระบบ — กลับคืนไม่ได้
--
-- ลบ: PO, WHT, Stock, Products, Suppliers, Staff, Bank, Payroll
-- เก็บ: users (1), roles (6), permissions (78), role_permissions (78)
--
-- ใช้คำสั่ง:
--   docker compose exec -T sales-db psql -U sales_admin -d sales_system < reset_data.sql
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- ────────────────────────────────────────────────────────────
-- Step 1: Break FK ที่อ้าง staff (เพื่อให้ truncate staff ได้)
-- ────────────────────────────────────────────────────────────
-- users.staff_id → staff: ตั้งเป็น NULL (เก็บ user ไว้)
UPDATE users SET staff_id = NULL WHERE staff_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- Step 2: TRUNCATE ทุก table ที่ต้องลบ — ใน statement เดียว
--   • RESTART IDENTITY → reset sequence (id เริ่ม 1 ใหม่)
--   • CASCADE         → ลบ child rows อัตโนมัติ
-- ────────────────────────────────────────────────────────────
TRUNCATE TABLE
  -- WHT chain
  withholding_tax_items,
  withholding_tax_cert,
  withholding_tax,

  -- PO chain
  po_documents,
  po_approvals,
  po_items,
  purchase_orders,

  -- Stock + Product chain
  stock_movements,
  product_serials,
  products,
  product_categories,
  product_units,

  -- Suppliers
  suppliers,

  -- Payroll
  payroll,
  salary_adjustments,

  -- Staff (parent + children — CASCADE handles dependencies)
  staff_address,
  staff_contact,
  staff_documents,
  staff_employment,
  staff_history,
  staff_notes,
  staff_salary,
  staff,

  -- Departments
  departments,

  -- Bank
  company_bank_accounts,

  -- Login logs (FK → users; ลบ logs เก่าด้วย)
  login_logs
RESTART IDENTITY CASCADE;

COMMIT;

-- ────────────────────────────────────────────────────────────
-- Verify ผลลัพธ์
-- ────────────────────────────────────────────────────────────
\echo ''
\echo '═══ KEPT (ต้องมีค่า > 0) ═══'
SELECT 'users' AS t, COUNT(*) FROM users
UNION ALL SELECT 'roles', COUNT(*) FROM roles
UNION ALL SELECT 'permissions', COUNT(*) FROM permissions
UNION ALL SELECT 'role_permissions', COUNT(*) FROM role_permissions;

\echo ''
\echo '═══ DELETED (ต้องเป็น 0 ทุก table) ═══'
SELECT 'purchase_orders' AS t, COUNT(*) FROM purchase_orders
UNION ALL SELECT 'po_items', COUNT(*) FROM po_items
UNION ALL SELECT 'withholding_tax', COUNT(*) FROM withholding_tax
UNION ALL SELECT 'withholding_tax_items', COUNT(*) FROM withholding_tax_items
UNION ALL SELECT 'stock_movements', COUNT(*) FROM stock_movements
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'suppliers', COUNT(*) FROM suppliers
UNION ALL SELECT 'staff', COUNT(*) FROM staff
UNION ALL SELECT 'departments', COUNT(*) FROM departments
UNION ALL SELECT 'company_bank_accounts', COUNT(*) FROM company_bank_accounts
UNION ALL SELECT 'payroll', COUNT(*) FROM payroll
UNION ALL SELECT 'login_logs', COUNT(*) FROM login_logs;

\echo ''
\echo '═══ users.staff_id หลัง reset (ต้อง NULL) ═══'
SELECT id, username, staff_id, role_id FROM users;
