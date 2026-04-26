-- =============================================================================
-- Migration: เพิ่ม parent_id ใน product_categories (รองรับหมวดย่อย 2 ระดับ)
-- Date: 2026-04-26
-- Idempotent: รันซ้ำได้
-- =============================================================================

-- 1. เพิ่ม column parent_id (self-reference)
DO $mig$ BEGIN
  ALTER TABLE public.product_categories
    ADD COLUMN IF NOT EXISTS parent_id INTEGER;
EXCEPTION WHEN OTHERS THEN NULL;
END $mig$;

-- 2. เพิ่ม FK constraint (ON DELETE CASCADE — ลบหมวดหลัก → หมวดย่อยหายตาม)
DO $mig$ BEGIN
  ALTER TABLE public.product_categories
    ADD CONSTRAINT product_categories_parent_fkey
    FOREIGN KEY (parent_id)
    REFERENCES public.product_categories(id)
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
WHEN OTHERS THEN NULL;
END $mig$;

-- 3. Index สำหรับ query หา children เร็ว ๆ
CREATE INDEX IF NOT EXISTS idx_product_categories_parent_id
  ON public.product_categories(parent_id);

-- 4. ป้องกัน 3 ระดับ: parent_id ของหมวดย่อย ห้ามชี้ไปหมวดที่มี parent อยู่แล้ว
--    (ใช้ trigger เพราะ CHECK constraint อ้างอิง subquery ไม่ได้)
CREATE OR REPLACE FUNCTION enforce_max_category_depth()
RETURNS TRIGGER AS $$
DECLARE
  parent_has_parent BOOLEAN;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- ห้าม self-reference
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'หมวดหมู่ไม่สามารถเป็น parent ของตัวเองได้';
  END IF;

  -- เช็คว่า parent ที่จะผูก ไม่ได้เป็นหมวดย่อยอยู่แล้ว
  SELECT (parent_id IS NOT NULL) INTO parent_has_parent
  FROM public.product_categories
  WHERE id = NEW.parent_id;

  IF parent_has_parent THEN
    RAISE EXCEPTION 'รองรับหมวดย่อยได้สูงสุด 2 ระดับ (หมวดหลัก > หมวดย่อย)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_category_depth ON public.product_categories;
CREATE TRIGGER trg_enforce_category_depth
  BEFORE INSERT OR UPDATE OF parent_id ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION enforce_max_category_depth();

-- 5. ตรวจผล
SELECT
  'product_categories' AS table_name,
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE parent_id IS NULL) AS parents,
  COUNT(*) FILTER (WHERE parent_id IS NOT NULL) AS children
FROM public.product_categories;
