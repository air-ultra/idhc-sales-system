-- ==========================================================
-- Phase 3.2A — Quotation CRUD
-- วันที่: 2026-05-03
-- สร้าง: quotations + quotation_items
-- Idempotent
-- ==========================================================

-- ---- 1) ตาราง quotations (header) ----
CREATE TABLE IF NOT EXISTS quotations (
  id                    SERIAL PRIMARY KEY,
  quotation_no          VARCHAR(20) NOT NULL UNIQUE,    -- QT2026050001 (YYYYMM + 4 digit running)

  -- Dates
  issue_date            DATE NOT NULL,                  -- วันที่ออกใบ
  valid_days            INTEGER NOT NULL DEFAULT 30,    -- วันยืนราคา (default 30)
  valid_until           DATE,                           -- วันหมดอายุ (auto: issue_date + valid_days)
  credit_days           INTEGER NOT NULL DEFAULT 0,     -- เครดิตชำระเงิน (วัน) — แยกจาก valid_days

  -- References
  customer_id           INTEGER NOT NULL REFERENCES customers(id),
  contact_id            INTEGER REFERENCES customer_contacts(id) ON DELETE SET NULL,
  salesperson_id        INTEGER REFERENCES staff(id) ON DELETE SET NULL,

  -- Project info
  project_name          VARCHAR(200),                   -- โปรเจค
  reference_no          VARCHAR(100),                   -- เลขที่อ้างอิง

  -- Pricing mode
  price_includes_vat    BOOLEAN NOT NULL DEFAULT FALSE, -- 'ราคารวมภาษี' (true) vs 'ราคาไม่รวมภาษี' (false)

  -- Discount (รองรับทั้ง 2 mode)
  discount_mode         VARCHAR(10) NOT NULL DEFAULT 'percent',  -- 'percent' | 'amount'
  discount_percent      NUMERIC(5,2) NOT NULL DEFAULT 0,         -- ใช้เมื่อ mode='percent'
  discount_amount       NUMERIC(15,2) NOT NULL DEFAULT 0,        -- snapshot ส่วนลดจริง (บาท)

  -- VAT
  vat_rate              NUMERIC(5,2) NOT NULL DEFAULT 7.00,      -- 7.00 หรือ 0.00 (ไม่มีภาษี)
  vat_amount            NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- WHT (หัก ณ ที่จ่าย — optional)
  wht_rate              NUMERIC(5,2) NOT NULL DEFAULT 0,         -- 0/1/2/3/5/10/15
  wht_amount            NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Computed totals (snapshot ตอน save — เพื่อ list/detail แสดงเร็ว)
  subtotal              NUMERIC(15,2) NOT NULL DEFAULT 0,        -- รวมก่อนส่วนลด
  amount_after_discount NUMERIC(15,2) NOT NULL DEFAULT 0,        -- หลังส่วนลด (ก่อน VAT)
  grand_total           NUMERIC(15,2) NOT NULL DEFAULT 0,        -- ยอดรวมทั้งสิ้น (รวม VAT)
  net_payable           NUMERIC(15,2) NOT NULL DEFAULT 0,        -- ยอดชำระ (grand - WHT)

  notes                 TEXT,                           -- หมายเหตุ (เช่น "บริการไม่รวม...")
  status                VARCHAR(20) NOT NULL DEFAULT 'draft',
                        -- 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'

  created_by            INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotations_customer_id ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status      ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_issue_date  ON quotations(issue_date DESC);

-- ---- 2) ตาราง quotation_items (line items) ----
CREATE TABLE IF NOT EXISTS quotation_items (
  id                    SERIAL PRIMARY KEY,
  quotation_id          INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  display_order         INTEGER NOT NULL DEFAULT 0,

  -- product reference (NULLABLE — รองรับ free-text item)
  product_id            INTEGER REFERENCES products(id) ON DELETE SET NULL,

  -- Snapshot ทุก field — ใช้แสดงผลในใบนี้ตลอดอายุ ไม่ต้อง join product master
  -- (ถ้า product_id NOT NULL: copy จาก product ตอน save)
  -- (ถ้า product_id IS NULL: free-text — user พิมพ์เอง)
  product_name          VARCHAR(255) NOT NULL,
  product_model         VARCHAR(100),
  product_brand         VARCHAR(100),
  description           TEXT,                           -- รายละเอียด/Scope of Services

  -- Quantity & pricing
  quantity              NUMERIC(15,2) NOT NULL DEFAULT 1,
  unit                  VARCHAR(30),
  unit_price            NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_price           NUMERIC(15,2) NOT NULL DEFAULT 0,        -- = quantity × unit_price

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_product_id   ON quotation_items(product_id);

-- ---- 3) ตรวจผล ----
\d quotations
\d quotation_items
