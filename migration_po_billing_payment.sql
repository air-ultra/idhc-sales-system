-- ============================================================
-- Migration: PO Billing + Payment + Credit + WHT link
-- ============================================================

-- ฟิลด์ใหม่ตอนสร้าง PO
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS ordered_by_staff_id INTEGER REFERENCES staff(id);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS job_name VARCHAR(200);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS credit_days INTEGER DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS wht_rate NUMERIC(5,2) DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS wht_amount NUMERIC(15,2) DEFAULT 0;

-- Billing
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS bill_number VARCHAR(50);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS bill_date DATE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS bill_notes TEXT;

-- Payment
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid';
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_date DATE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(15,2);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_notes TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS withholding_id INTEGER REFERENCES withholding_tax(id);

-- Index
CREATE INDEX IF NOT EXISTS idx_po_ordered_by ON purchase_orders(ordered_by_staff_id);
CREATE INDEX IF NOT EXISTS idx_po_payment_status ON purchase_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_po_withholding ON purchase_orders(withholding_id);

-- ตรวจผล
\d purchase_orders
