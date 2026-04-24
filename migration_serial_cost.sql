-- ============================================================
-- Migration: เก็บต้นทุนต่อ serial
-- รันใน sales-db ได้เลย ปลอดภัย (IF NOT EXISTS)
-- ============================================================

ALTER TABLE product_serials
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(15,2) DEFAULT 0;

-- ตรวจ schema
\d product_serials
