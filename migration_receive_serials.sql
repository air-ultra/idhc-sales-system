-- ============================================================
-- Migration: เพิ่ม column ที่จำเป็นสำหรับ "รับสินค้าพร้อม Serial"
-- รันใน sales-db ได้เลย ปลอดภัย (IF NOT EXISTS ทั้งหมด)
-- ============================================================

-- purchase_orders: track การรับ
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS received_by INTEGER REFERENCES users(id);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS received_at TIMESTAMP;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

-- product_serials: ต้องมี po_id เชื่อมต้นทาง (schema เดิมน่าจะมีแล้ว)
ALTER TABLE product_serials ADD COLUMN IF NOT EXISTS po_id INTEGER REFERENCES purchase_orders(id);
ALTER TABLE product_serials ADD COLUMN IF NOT EXISTS notes TEXT;

-- เช็ค index
CREATE INDEX IF NOT EXISTS idx_serial_po ON product_serials(po_id);
CREATE INDEX IF NOT EXISTS idx_serial_product ON product_serials(product_id);

-- ดู schema ปัจจุบัน
\d purchase_orders
\d product_serials
