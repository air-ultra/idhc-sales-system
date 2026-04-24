-- ============================================================
-- Migration: PO Documents (แนบเอกสารใน PO)
-- ============================================================

CREATE TABLE IF NOT EXISTS po_documents (
  id SERIAL PRIMARY KEY,
  po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100),
  file_size INTEGER,
  notes VARCHAR(500),
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_documents_po_id ON po_documents(po_id);

-- ตรวจผล
\d po_documents
