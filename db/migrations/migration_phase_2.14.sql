-- ========================================
-- Phase 2.14 — เพิ่ม brand + product_images
-- วันที่: 2026-05-03
-- Idempotent: รันซ้ำได้ปลอดภัย
-- ========================================

-- ---- 1) เพิ่ม column brand ใน products ----
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand VARCHAR(100);

-- ---- 2) สร้างตาราง product_images ----
CREATE TABLE IF NOT EXISTS product_images (
  id            SERIAL PRIMARY KEY,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  file_name     VARCHAR(255) NOT NULL,   -- ชื่อไฟล์ดั้งเดิม (สำหรับ download)
  file_path     VARCHAR(500) NOT NULL,   -- ชื่อไฟล์บน disk (timestamp_basename.ext)
  mime_type     VARCHAR(100),
  file_size     INTEGER,
  is_cover      BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  uploaded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);

-- ---- 3) Partial unique index: 1 product → cover ได้แค่ 1 รูป ----
DROP INDEX IF EXISTS uq_product_images_one_cover;
CREATE UNIQUE INDEX uq_product_images_one_cover
  ON product_images(product_id)
  WHERE is_cover = TRUE;

-- ตรวจผล
\d product_images
\d products
