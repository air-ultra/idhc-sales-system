// backend/src/routes/customers.js
// Phase 3.1 — Customer Master + Documents
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query, getClient } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

// ───── Document upload config (Phase 3.1.1) ─────
const docUploadDir = '/app/uploads/customers';
if (!fs.existsSync(docUploadDir)) fs.mkdirSync(docUploadDir, { recursive: true });

const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const customerDir = path.join(docUploadDir, String(req.params.id));
    if (!fs.existsSync(customerDir)) fs.mkdirSync(customerDir, { recursive: true });
    cb(null, customerDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9\u0E00-\u0E7F\-_ ]/g, '').substring(0, 60);
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});

const docUpload = multer({
  storage: docStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

/* ===== Helper: gen customer code (CUS-0001) ===== */
async function genCustomerCode() {
  const result = await query("SELECT nextval('customer_code_seq') AS seq");
  const n = parseInt(result.rows[0].seq, 10);
  return `CUS-${String(n).padStart(4, '0')}`;
}

/* ========================================
   CUSTOMERS
   ======================================== */

/* ----- LIST customers ----- */
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, is_active } = req.query;
    const params = [];
    const conditions = [];

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(c.customer_code ILIKE $${idx} OR c.name ILIKE $${idx} OR c.tax_id ILIKE $${idx} OR c.phone ILIKE $${idx})`);
    }
    if (is_active === 'true' || is_active === '1') {
      conditions.push(`c.is_active = TRUE`);
    } else if (is_active === 'false' || is_active === '0') {
      conditions.push(`c.is_active = FALSE`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
      `SELECT
         c.*,
         (SELECT COUNT(*)::int FROM customer_contacts WHERE customer_id = c.id) AS contact_count,
         (SELECT json_build_object('id', cc.id, 'name', cc.name, 'phone', cc.phone, 'email', cc.email)
            FROM customer_contacts cc
            WHERE cc.customer_id = c.id AND cc.is_primary = TRUE
            LIMIT 1
         ) AS primary_contact
       FROM customers c
       ${whereClause}
       ORDER BY c.id DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /customers error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ----- GET customer by id (รวม contacts) ----- */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const cust = await query(`SELECT * FROM customers WHERE id = $1`, [id]);
    if (cust.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });

    const contacts = await query(
      `SELECT * FROM customer_contacts
       WHERE customer_id = $1
       ORDER BY is_primary DESC, display_order ASC, id ASC`,
      [id]
    );
    res.json({ ...cust.rows[0], contacts: contacts.rows });
  } catch (err) {
    console.error('GET /customers/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ----- CREATE customer ----- */
router.post('/', authenticate, async (req, res) => {
  try {
    const d = req.body || {};
    if (!d.name || !String(d.name).trim()) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อลูกค้า' });
    }

    // ถ้ามี tax_id → ตรวจซ้ำก่อน insert (ให้ message ชัดกว่า DB error)
    if (d.tax_id && String(d.tax_id).trim()) {
      const dup = await query(
        `SELECT customer_code, name FROM customers WHERE tax_id = $1`,
        [String(d.tax_id).trim()]
      );
      if (dup.rows.length > 0) {
        return res.status(400).json({
          error: `เลขผู้เสียภาษีนี้มีอยู่แล้ว (${dup.rows[0].customer_code} — ${dup.rows[0].name})`
        });
      }
    }

    const code = await genCustomerCode();
    const result = await query(
      `INSERT INTO customers
         (customer_code, name, tax_id, branch, address, postal_code,
          phone, email, notes, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, TRUE), $11)
       RETURNING *`,
      [code, String(d.name).trim(),
       d.tax_id ? String(d.tax_id).trim() : null,
       d.branch || null, d.address || null, d.postal_code || null,
       d.phone || null, d.email || null, d.notes || null,
       d.is_active, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /customers error:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'ข้อมูลซ้ำกับลูกค้าที่มีอยู่แล้ว' });
    }
    res.status(500).json({ error: err.message });
  }
});

/* ----- UPDATE customer ----- */
const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const d = req.body || {};

    // ถ้าแก้ tax_id → ตรวจซ้ำกับ customer อื่น
    if (d.tax_id && String(d.tax_id).trim()) {
      const dup = await query(
        `SELECT customer_code, name FROM customers WHERE tax_id = $1 AND id <> $2`,
        [String(d.tax_id).trim(), id]
      );
      if (dup.rows.length > 0) {
        return res.status(400).json({
          error: `เลขผู้เสียภาษีนี้มีอยู่แล้ว (${dup.rows[0].customer_code} — ${dup.rows[0].name})`
        });
      }
    }

    const result = await query(
      `UPDATE customers SET
         name        = COALESCE($1, name),
         tax_id      = $2,
         branch      = $3,
         address     = $4,
         postal_code = $5,
         phone       = $6,
         email       = $7,
         notes       = $8,
         is_active   = COALESCE($9, is_active),
         updated_at  = NOW()
       WHERE id = $10
       RETURNING *`,
      [d.name ? String(d.name).trim() : null,
       d.tax_id ? String(d.tax_id).trim() : null,
       d.branch || null, d.address || null, d.postal_code || null,
       d.phone || null, d.email || null, d.notes || null,
       d.is_active, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /customers/:id error:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'ข้อมูลซ้ำกับลูกค้าที่มีอยู่แล้ว' });
    }
    res.status(500).json({ error: err.message });
  }
};
router.put('/:id', authenticate, updateCustomer);
router.patch('/:id', authenticate, updateCustomer);  // alias (กัน method mismatch ตาม section 10.11)

/* ----- DELETE customer ----- */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    // อนาคต: ตรวจ FK กับ quotations / sales_orders (ตอนนี้ยังไม่มี)
    // ถ้ามีในอนาคตจะ block ลบและให้ใช้ is_active = FALSE แทน

    const result = await query(`DELETE FROM customers WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /customers/:id error:', err);
    if (err.code === '23503') {
      return res.status(400).json({
        error: 'ลบไม่ได้: มีเอกสาร (ใบเสนอราคา/ใบสั่งขาย) อ้างอิงอยู่ — ใช้ "ปิดใช้งาน" แทน'
      });
    }
    res.status(500).json({ error: err.message });
  }
});

/* ========================================
   CUSTOMER CONTACTS
   ======================================== */

/* ----- LIST contacts ของลูกค้า ----- */
router.get('/:id/contacts', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT * FROM customer_contacts
       WHERE customer_id = $1
       ORDER BY is_primary DESC, display_order ASC, id ASC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET contacts error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ----- ADD contact ----- */
router.post('/:id/contacts', authenticate, async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const d = req.body || {};
    if (!d.name || !String(d.name).trim()) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ประสานงาน' });
    }

    // ตรวจ customer มีจริง
    const cust = await client.query(`SELECT id FROM customers WHERE id = $1`, [id]);
    if (cust.rows.length === 0) return res.status(404).json({ error: 'ไม่พบลูกค้า' });

    await client.query('BEGIN');

    // ถ้าตั้งเป็น primary → เคลียร์ primary เดิมก่อน (เพราะ partial unique index)
    if (d.is_primary) {
      await client.query(
        `UPDATE customer_contacts SET is_primary = FALSE WHERE customer_id = $1`,
        [id]
      );
    }

    const result = await client.query(
      `INSERT INTO customer_contacts
         (customer_id, name, position, phone, email, line_id,
          is_primary, display_order, notes)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, FALSE), COALESCE($8, 0), $9)
       RETURNING *`,
      [id, String(d.name).trim(),
       d.position || null, d.phone || null, d.email || null, d.line_id || null,
       d.is_primary, d.display_order, d.notes || null]
    );

    // ถ้าเป็น contact แรก → ตั้งเป็น primary auto (ถ้า user ไม่ได้กำหนด)
    const allContacts = await client.query(
      `SELECT COUNT(*)::int AS c, SUM(CASE WHEN is_primary THEN 1 ELSE 0 END)::int AS p
       FROM customer_contacts WHERE customer_id = $1`, [id]
    );
    if (allContacts.rows[0].c === 1 && allContacts.rows[0].p === 0) {
      await client.query(
        `UPDATE customer_contacts SET is_primary = TRUE WHERE id = $1`,
        [result.rows[0].id]
      );
      result.rows[0].is_primary = true;
    }

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST contact error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ----- UPDATE contact ----- */
router.put('/:id/contacts/:cid', authenticate, async (req, res) => {
  const client = await getClient();
  try {
    const { id, cid } = req.params;
    const d = req.body || {};

    await client.query('BEGIN');

    // ถ้าตั้งเป็น primary → เคลียร์ตัวอื่นก่อน
    if (d.is_primary) {
      await client.query(
        `UPDATE customer_contacts SET is_primary = FALSE
         WHERE customer_id = $1 AND id <> $2`,
        [id, cid]
      );
    }

    const result = await client.query(
      `UPDATE customer_contacts SET
         name          = COALESCE($1, name),
         position      = $2,
         phone         = $3,
         email         = $4,
         line_id       = $5,
         is_primary    = COALESCE($6, is_primary),
         display_order = COALESCE($7, display_order),
         notes         = $8,
         updated_at    = NOW()
       WHERE id = $9 AND customer_id = $10
       RETURNING *`,
      [d.name ? String(d.name).trim() : null,
       d.position || null, d.phone || null, d.email || null, d.line_id || null,
       d.is_primary, d.display_order, d.notes || null,
       cid, id]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'ไม่พบผู้ประสานงาน' });
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PUT contact error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ----- DELETE contact ----- */
router.delete('/:id/contacts/:cid', authenticate, async (req, res) => {
  const client = await getClient();
  try {
    const { id, cid } = req.params;

    await client.query('BEGIN');

    // ตรวจว่ามีอยู่ + เป็น primary หรือเปล่า
    const found = await client.query(
      `SELECT is_primary FROM customer_contacts WHERE id = $1 AND customer_id = $2`,
      [cid, id]
    );
    if (found.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'ไม่พบผู้ประสานงาน' });
    }
    const wasPrimary = found.rows[0].is_primary;

    await client.query(`DELETE FROM customer_contacts WHERE id = $1`, [cid]);

    // ถ้าลบ primary ไป → ตั้ง contact ที่เหลือ (ตัวแรก) เป็น primary ใหม่
    if (wasPrimary) {
      const next = await client.query(
        `SELECT id FROM customer_contacts WHERE customer_id = $1
         ORDER BY display_order ASC, id ASC LIMIT 1`,
        [id]
      );
      if (next.rows.length > 0) {
        await client.query(
          `UPDATE customer_contacts SET is_primary = TRUE WHERE id = $1`,
          [next.rows[0].id]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('DELETE contact error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ========================================
   CUSTOMER DOCUMENTS (Phase 3.1.1)
   ======================================== */

/* ----- LIST documents ----- */
router.get('/:id/documents', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT d.*, u.username AS uploaded_by_name
       FROM customer_documents d
       LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE d.customer_id = $1
       ORDER BY d.uploaded_at DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /customers/:id/documents error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ----- UPLOAD document ----- */
router.post('/:id/documents', authenticate, docUpload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'ไม่มีไฟล์แนบ' });

    // ตรวจ customer มีจริง
    const cust = await query(`SELECT id FROM customers WHERE id = $1`, [id]);
    if (cust.rows.length === 0) {
      try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
      return res.status(404).json({ error: 'ไม่พบลูกค้า' });
    }

    const result = await query(
      `INSERT INTO customer_documents
         (customer_id, file_name, file_path, mime_type, file_size, notes, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, req.file.originalname, req.file.filename,
       req.file.mimetype, req.file.size,
       req.body.notes || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /customers/:id/documents error:', err);
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
    }
    res.status(500).json({ error: err.message });
  }
});

/* ----- DOWNLOAD document ----- */
router.get('/:id/documents/:docId/download', authenticate, async (req, res) => {
  try {
    const { id, docId } = req.params;
    const result = await query(
      `SELECT * FROM customer_documents WHERE id = $1 AND customer_id = $2`,
      [docId, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'ไม่พบไฟล์' });

    const doc = result.rows[0];
    const filePath = path.join(docUploadDir, String(id), doc.file_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'ไฟล์หายจาก server' });

    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(doc.file_name)}`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('GET document download error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ----- DELETE document ----- */
router.delete('/:id/documents/:docId', authenticate, async (req, res) => {
  try {
    const { id, docId } = req.params;
    const result = await query(
      `SELECT * FROM customer_documents WHERE id = $1 AND customer_id = $2`,
      [docId, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'ไม่พบไฟล์' });

    const doc = result.rows[0];
    const filePath = path.join(docUploadDir, String(id), doc.file_path);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) { console.warn('unlink:', e.message); }
    }

    await query(`DELETE FROM customer_documents WHERE id = $1`, [docId]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE document error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
