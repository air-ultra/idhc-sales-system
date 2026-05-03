-- ==========================================================
-- Phase 3.1 — Customer Master
-- วันที่: 2026-05-03
-- สร้าง: customers, customer_contacts + sequence customer_code_seq
-- Idempotent: รันซ้ำได้ปลอดภัย
-- ==========================================================

-- ---- 1) Sequence สำหรับ customer_code (CUS-0001) ----
CREATE SEQUENCE IF NOT EXISTS public.customer_code_seq
  AS INTEGER
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- ---- 2) ตาราง customers ----
CREATE TABLE IF NOT EXISTS customers (
  id            SERIAL PRIMARY KEY,
  customer_code VARCHAR(30) NOT NULL UNIQUE,        -- CUS-0001 auto
  name          VARCHAR(255) NOT NULL,              -- ชื่อบริษัท
  tax_id        VARCHAR(20),                        -- เลขผู้เสียภาษี (UNIQUE — partial)
  branch        VARCHAR(50),                        -- สาขา (สำนักงานใหญ่/00001/...)
  address       TEXT,
  postal_code   VARCHAR(10),
  phone         VARCHAR(50),                        -- เบอร์บริษัท
  email         VARCHAR(100),
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- tax_id UNIQUE (partial — null อนุญาตซ้ำได้เพราะลูกค้าใหม่อาจยังไม่ได้กรอก tax_id)
DROP INDEX IF EXISTS uq_customers_tax_id;
CREATE UNIQUE INDEX uq_customers_tax_id
  ON customers(tax_id)
  WHERE tax_id IS NOT NULL AND tax_id <> '';

-- Search index (รองรับ ILIKE บน name + tax_id)
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active);

-- ---- 3) ตาราง customer_contacts (1 customer → many contacts) ----
CREATE TABLE IF NOT EXISTS customer_contacts (
  id            SERIAL PRIMARY KEY,
  customer_id   INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,              -- ชื่อผู้ประสานงาน
  position      VARCHAR(100),                       -- ตำแหน่ง
  phone         VARCHAR(50),
  email         VARCHAR(100),
  line_id       VARCHAR(100),
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,     -- contact หลัก (1 ต่อ customer)
  display_order INTEGER NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer_id
  ON customer_contacts(customer_id);

-- 1 customer = 1 primary contact เท่านั้น (partial unique index)
DROP INDEX IF EXISTS uq_customer_contacts_one_primary;
CREATE UNIQUE INDEX uq_customer_contacts_one_primary
  ON customer_contacts(customer_id)
  WHERE is_primary = TRUE;

-- ---- 4) ตรวจผล ----
\d customers
\d customer_contacts

-- แสดง sequence value (ตอนนี้ควรเป็น 1)
SELECT last_value FROM customer_code_seq;
