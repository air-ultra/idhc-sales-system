-- migration_po_item_wht.sql
-- เพิ่มหัก ณ ที่จ่ายระดับรายการ
-- 2026-04-25

-- 1. เพิ่ม column ใน po_items
ALTER TABLE po_items
  ADD COLUMN IF NOT EXISTS wht_rate NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wht_amount NUMERIC(15,2) DEFAULT 0;

-- 2. backfill ข้อมูลเก่า: PO ที่มี wht_rate ของ header
--    → กระจายลง item ทุกตัว (ใช้อัตรา PO เป็น default รายตัว)
UPDATE po_items pi
SET wht_rate = po.wht_rate,
    wht_amount = ROUND(pi.total_price * po.wht_rate / 100, 2)
FROM purchase_orders po
WHERE pi.po_id = po.id
  AND po.wht_rate > 0
  AND COALESCE(pi.wht_rate, 0) = 0;

-- 3. (optional) แสดงผลลัพธ์เพื่อ verify
SELECT
  COUNT(*) AS total_items,
  COUNT(*) FILTER (WHERE wht_rate > 0) AS items_with_wht,
  SUM(wht_amount) AS total_wht_amount
FROM po_items;
