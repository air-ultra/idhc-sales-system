-- =============================================================================
-- Migration: Phase 3.3B.1 — Sales Order extra fields + attachments
-- Date: 2026-05-04
-- =============================================================================
-- Adds:
--   1. sales_orders: billing_customer_id, site_customer_id, installation_date,
--                    credit_days, payment_terms_notes, reference_no
--   2. so_attachments: new table for multi-file uploads (PO from customer,
--                       email confirm, etc.)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. ALTER sales_orders — add new columns
-- ---------------------------------------------------------------------------
ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS billing_customer_id  INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS site_customer_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS installation_date    DATE,
  ADD COLUMN IF NOT EXISTS credit_days          INTEGER,
  ADD COLUMN IF NOT EXISTS payment_terms_notes  TEXT,
  ADD COLUMN IF NOT EXISTS reference_no         VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_so_billing_customer ON sales_orders(billing_customer_id);
CREATE INDEX IF NOT EXISTS idx_so_site_customer    ON sales_orders(site_customer_id);

COMMENT ON COLUMN sales_orders.billing_customer_id IS 'NULL = bill in name of customer_id (default). FK to customers — pick from master.';
COMMENT ON COLUMN sales_orders.site_customer_id    IS 'NULL = installation site = customer_id address (default). FK to customers — pick from master.';
COMMENT ON COLUMN sales_orders.installation_date   IS 'Optional — separate from delivery_date';
COMMENT ON COLUMN sales_orders.credit_days         IS 'Credit period in days (e.g. 30/45/60). Used by Phase 3.5 to compute invoice due_date.';
COMMENT ON COLUMN sales_orders.payment_terms_notes IS 'Free-text notes: billing window, cheque schedule, accounting contact, etc.';
COMMENT ON COLUMN sales_orders.reference_no        IS 'Customer PO number — copied from quotations.reference_no when SO created from QT.';

-- ---------------------------------------------------------------------------
-- 2. so_attachments — multi-file upload per SO
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS so_attachments (
  id           SERIAL PRIMARY KEY,
  so_id        INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  file_name    VARCHAR(255) NOT NULL,    -- user-defined display name
  original_name VARCHAR(255),             -- actual uploaded filename
  file_path    VARCHAR(500) NOT NULL,    -- relative path (uploads/so/...)
  file_size    BIGINT,
  mime_type    VARCHAR(100),
  uploaded_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_so_attachments_so_id ON so_attachments(so_id);

COMMENT ON TABLE so_attachments IS 'Multi-file attachments per SO. file_name = user-defined; original_name = uploaded filename.';

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
-- \d sales_orders
-- \d so_attachments
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'sales_orders' AND column_name IN ('billing_customer_id','site_customer_id','installation_date','credit_days','payment_terms_notes','reference_no');
