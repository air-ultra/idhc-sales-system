-- ==========================================================
-- Phase 3.1.1 — Customer Documents
-- วันที่: 2026-05-03
-- Idempotent
-- ==========================================================

CREATE TABLE IF NOT EXISTS customer_documents (
  id            SERIAL PRIMARY KEY,
  customer_id   INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  file_name     VARCHAR(255) NOT NULL,
  file_path     VARCHAR(500) NOT NULL,    -- ชื่อไฟล์บน disk (timestamp_basename.ext)
  mime_type     VARCHAR(100),
  file_size     INTEGER,
  notes         VARCHAR(500),
  uploaded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_documents_customer_id
  ON customer_documents(customer_id);

\d customer_documents
