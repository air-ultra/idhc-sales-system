-- =============================================================================
-- Migration: Phase 3.3A — Sales Order Module
-- Date: 2026-05-04
-- =============================================================================
-- Adds:
--   1. sales_orders          — main SO table
--   2. so_items              — SO line items (mirror quotation_items pattern)
--   3. so_item_serials       — junction table SO item ↔ product_serials (Phase 3.3D)
--   4. product_serials       — add sold_at column for quick sold-date lookups
--   5. so_number_seq         — sequence for SO number generation (per month)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. sales_orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_orders (
  id              SERIAL PRIMARY KEY,
  so_number       VARCHAR(20) UNIQUE NOT NULL,

  -- Source link
  quotation_id    INTEGER REFERENCES quotations(id) ON DELETE SET NULL,

  -- Customer + Salesperson (snapshot, editable until approved)
  customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  contact_id      INTEGER REFERENCES customer_contacts(id) ON DELETE SET NULL,
  salesperson_id  INTEGER REFERENCES staff(id) ON DELETE SET NULL,

  -- Document info
  issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date   DATE,
  project_name    VARCHAR(200),
  notes           TEXT,

  -- Money fields (server-authoritative — recompute on save)
  subtotal              NUMERIC(15,2) DEFAULT 0,
  discount_mode         VARCHAR(10)   DEFAULT 'amount',   -- 'percent' | 'amount'
  discount_percent      NUMERIC(5,2)  DEFAULT 0,
  discount_amount       NUMERIC(15,2) DEFAULT 0,
  amount_after_discount NUMERIC(15,2) DEFAULT 0,
  vat_rate              NUMERIC(5,2)  DEFAULT 7.00,
  vat_amount            NUMERIC(15,2) DEFAULT 0,
  wht_rate              NUMERIC(5,2)  DEFAULT 0,
  wht_amount            NUMERIC(15,2) DEFAULT 0,
  grand_total           NUMERIC(15,2) DEFAULT 0,
  net_payable           NUMERIC(15,2) DEFAULT 0,
  price_includes_vat    BOOLEAN       DEFAULT FALSE,

  -- Cost (computed on approve — sum of so_items.total_cost)
  total_cost            NUMERIC(15,2) DEFAULT 0,

  -- Workflow
  status        VARCHAR(20) NOT NULL DEFAULT 'draft',
                -- 'draft' | 'approved' | 'completed' | 'cancelled'

  approved_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at   TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  cancelled_at  TIMESTAMPTZ,
  cancel_reason TEXT,

  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_so_status CHECK (status IN ('draft','approved','completed','cancelled')),
  CONSTRAINT chk_so_discount_mode CHECK (discount_mode IN ('percent','amount'))
);

CREATE INDEX IF NOT EXISTS idx_so_customer    ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_so_quotation   ON sales_orders(quotation_id);
CREATE INDEX IF NOT EXISTS idx_so_status      ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_so_issue_date  ON sales_orders(issue_date);

-- 1 QT = 1 active SO (allow re-create after cancel)
CREATE UNIQUE INDEX IF NOT EXISTS uq_so_one_per_quotation
  ON sales_orders(quotation_id)
  WHERE quotation_id IS NOT NULL AND status != 'cancelled';

COMMENT ON TABLE sales_orders IS 'Internal sales orders — Phase 3.3A';
COMMENT ON COLUMN sales_orders.total_cost IS 'Computed on approve: sum(so_items.total_cost) which is sum(serial.cost_price)';
COMMENT ON COLUMN sales_orders.status IS 'draft → approved (stock cut) → completed | cancelled';

-- ---------------------------------------------------------------------------
-- 2. so_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS so_items (
  id              SERIAL PRIMARY KEY,
  so_id           INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  display_order   INTEGER NOT NULL DEFAULT 0,

  -- Product reference (NULL allowed in draft; required for approve — enforced in app)
  product_id      INTEGER REFERENCES products(id) ON DELETE SET NULL,

  -- Snapshot fields (mirror quotation_items)
  product_name    VARCHAR(255) NOT NULL,
  product_brand   VARCHAR(100),
  product_model   VARCHAR(100),
  description     TEXT,
  unit            VARCHAR(30),

  -- Pricing
  quantity        NUMERIC(15,2) NOT NULL DEFAULT 1,
  unit_price      NUMERIC(15,2) NOT NULL DEFAULT 0,   -- 0 allowed (free items)
  total_price     NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Cost (set on approve from picked serials avg)
  unit_cost       NUMERIC(15,2) DEFAULT 0,
  total_cost      NUMERIC(15,2) DEFAULT 0,

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_so_items_so_id      ON so_items(so_id);
CREATE INDEX IF NOT EXISTS idx_so_items_product_id ON so_items(product_id);

COMMENT ON COLUMN so_items.product_id IS 'NULL = free-text item (must be mapped before SO approve)';

-- ---------------------------------------------------------------------------
-- 3. so_item_serials
--    Junction so_item ↔ product_serials (1 serial = 1 SO item, strict)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS so_item_serials (
  id           SERIAL PRIMARY KEY,
  so_item_id   INTEGER NOT NULL REFERENCES so_items(id) ON DELETE CASCADE,
  serial_id    INTEGER NOT NULL REFERENCES product_serials(id) ON DELETE RESTRICT,
  picked_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  picked_at    TIMESTAMPTZ DEFAULT NOW(),

  -- Strict: 1 serial sold once forever (RMA = future phase)
  CONSTRAINT uq_so_item_serials_serial UNIQUE (serial_id)
);

CREATE INDEX IF NOT EXISTS idx_so_item_serials_so_item ON so_item_serials(so_item_id);

COMMENT ON TABLE so_item_serials IS 'Junction: so_items ↔ product_serials. UNIQUE(serial_id) — strict 1 serial sold forever (RMA in future phase)';

-- ---------------------------------------------------------------------------
-- 4. product_serials — add sold_at for quick lookups
-- ---------------------------------------------------------------------------
ALTER TABLE product_serials
  ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_serial_sold_at
  ON product_serials(sold_at)
  WHERE sold_at IS NOT NULL;

COMMENT ON COLUMN product_serials.sold_at IS 'Set when SO approves and serial picked — for warranty/service contract calculations';

-- ---------------------------------------------------------------------------
-- 5. so_number_seq (per-month running, reset by app — like PO/QT)
-- ---------------------------------------------------------------------------
-- No DB sequence — the app uses scan-last-and-increment per YYYYMM
-- (same pattern as PO/QT, see purchaseOrders.js / quotations.js)

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
-- SELECT 'sales_orders'      AS tbl, COUNT(*) FROM sales_orders;
-- SELECT 'so_items'          AS tbl, COUNT(*) FROM so_items;
-- SELECT 'so_item_serials'   AS tbl, COUNT(*) FROM so_item_serials;
-- \d sales_orders
-- \d so_items
-- \d so_item_serials
-- \d product_serials
