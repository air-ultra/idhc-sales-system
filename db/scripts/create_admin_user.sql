-- ═══════════════════════════════════════════════════════════
-- CREATE ADMIN USER — กู้คืนหลังจาก reset_data.sql ลบ users ไป
-- ═══════════════════════════════════════════════════════════
-- Username: admin
-- Password: admin123
-- Role: admin (id=1)
-- ใช้คำสั่ง:
--   docker compose exec -T sales-db psql -U sales_admin -d sales_system < create_admin_user.sql
-- ═══════════════════════════════════════════════════════════

INSERT INTO users (username, email, password_hash, role_id, is_active, staff_id)
VALUES (
  'admin',
  'admin@idhc.local',
  '$2a$10$OAB4NdNawFpM4wug/n9oUuTeyMAtY9ndN22wwP0YCo3ZquPqEIqoe',  -- bcrypt('admin123', 10)
  1,                       -- role_id = 1 (admin)
  true,                    -- is_active
  NULL                     -- staff_id (ยังไม่ได้สร้าง staff — ผูกทีหลัง)
)
ON CONFLICT (username) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      role_id = EXCLUDED.role_id,
      is_active = true,
      updated_at = now();

-- Verify
\echo ''
\echo '═══ Admin user created ═══'
SELECT u.id, u.username, u.email, u.is_active, u.staff_id, r.code AS role_code
  FROM users u
  LEFT JOIN roles r ON r.id = u.role_id
 WHERE u.username = 'admin';
