// backend/src/routes/salesOrders.js
// Phase 3.3A — Sales Order CRUD (no approve/stock-cut yet — that's Phase 3.3D)
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { query, getClient } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

/* ===== Multer setup for SO attachments ===== */
const uploadsBaseDir = process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads');
const soUploadsDir = path.join(uploadsBaseDir, 'so');
if (!fs.existsSync(soUploadsDir)) {
  fs.mkdirSync(soUploadsDir, { recursive: true });
}

const soStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, soUploadsDir),
  filename: (req, file, cb) => {
    const ts = Date.now();
    const safe = String(file.originalname).replace(/[^\w.\-]+/g, '_');
    cb(null, `so_${req.params.id}_${ts}_${safe}`);
  },
});
const soUpload = multer({
  storage: soStorage,
  limits: { fileSize: 20 * 1024 * 1024 },  // 20MB max
});

/* ===== Helper: gen SO number (SO202605####) ===== */
async function genSoNumber(client, issueDate) {
  const d = issueDate ? new Date(issueDate) : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const prefix = `SO${yyyy}${mm}`;
  const last = await client.query(
    `SELECT so_number FROM sales_orders
     WHERE so_number LIKE $1
     ORDER BY so_number DESC LIMIT 1`,
    [prefix + '%']
  );
  let next = 1;
  if (last.rows.length > 0) {
    const lastNo = last.rows[0].so_number;
    next = parseInt(lastNo.slice(prefix.length), 10) + 1;
  }
  return `${prefix}${String(next).padStart(4, '0')}`;
}

/* ===== Server-authoritative money computation ===== */
function computeAmounts(d) {
  const items = Array.isArray(d.items) ? d.items : [];
  const subtotal = items.reduce(
    (sum, it) => sum + Number(it.quantity || 0) * Number(it.unit_price || 0),
    0
  );

  const discountMode = d.discount_mode === 'percent' ? 'percent' : 'amount';
  let discountAmount = 0;
  let discountPercent = Number(d.discount_percent || 0);
  if (discountMode === 'percent') {
    discountAmount = (subtotal * discountPercent) / 100;
  } else {
    discountAmount = Number(d.discount_amount || 0);
    discountPercent = 0;
  }
  // Clamp
  if (discountAmount < 0) discountAmount = 0;
  if (discountAmount > subtotal) discountAmount = subtotal;

  const amountAfterDiscount = subtotal - discountAmount;

  const vatRate = Number(d.vat_rate || 0);
  const priceIncludesVat = !!d.price_includes_vat;
  let vatAmount = 0;
  let grandTotal = amountAfterDiscount;
  if (vatRate > 0) {
    if (priceIncludesVat) {
      // VAT-inclusive — extract VAT
      vatAmount = amountAfterDiscount - amountAfterDiscount / (1 + vatRate / 100);
      grandTotal = amountAfterDiscount;
    } else {
      vatAmount = (amountAfterDiscount * vatRate) / 100;
      grandTotal = amountAfterDiscount + vatAmount;
    }
  }

  const whtRate = Number(d.wht_rate || 0);
  const whtAmount = whtRate > 0
    ? (amountAfterDiscount * whtRate) / 100
    : 0;
  const netPayable = grandTotal - whtAmount;

  return {
    subtotal: round2(subtotal),
    discount_mode: discountMode,
    discount_percent: round2(discountPercent),
    discount_amount: round2(discountAmount),
    amount_after_discount: round2(amountAfterDiscount),
    vat_rate: round2(vatRate),
    vat_amount: round2(vatAmount),
    wht_rate: round2(whtRate),
    wht_amount: round2(whtAmount),
    grand_total: round2(grandTotal),
    net_payable: round2(netPayable),
    price_includes_vat: priceIncludesVat,
  };
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/* ===== Validation: items required, names non-empty ===== */
function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'ต้องมีรายการสินค้าอย่างน้อย 1 รายการ';
  }
  for (const it of items) {
    if (!it.product_name || !String(it.product_name).trim()) {
      return 'ทุกรายการต้องมีชื่อสินค้า';
    }
    if (Number(it.quantity || 0) <= 0) {
      return `รายการ "${it.product_name}" ต้องระบุจำนวนมากกว่า 0`;
    }
  }
  return null;
}

/* ----- GET list (with filters) ----- */
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, customer_id, q } = req.query;
    const params = [];
    const where = [];
    if (status) {
      params.push(status);
      where.push(`so.status = $${params.length}`);
    }
    if (customer_id) {
      params.push(customer_id);
      where.push(`so.customer_id = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(so.so_number ILIKE $${params.length} OR c.name ILIKE $${params.length} OR so.project_name ILIKE $${params.length})`);
    }
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const result = await query(
      `SELECT
         so.id, so.so_number, so.quotation_id, so.customer_id, so.salesperson_id,
         so.issue_date, so.delivery_date, so.project_name,
         so.subtotal, so.grand_total, so.net_payable, so.total_cost,
         so.status, so.created_at, so.approved_at, so.completed_at,
         c.customer_code, c.name AS customer_name,
         q.quotation_no,
         s.first_name_th AS salesperson_first_name,
         s.last_name_th AS salesperson_last_name,
         (SELECT COUNT(*) FROM so_items WHERE so_id = so.id) AS item_count
       FROM sales_orders so
       LEFT JOIN customers c ON c.id = so.customer_id
       LEFT JOIN quotations q ON q.id = so.quotation_id
       LEFT JOIN staff s ON s.id = so.salesperson_id
       ${whereClause}
       ORDER BY so.id DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /sales-orders error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ----- GET by id (with items + customer + salesperson) ----- */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const soRes = await query(
      `SELECT
         so.*,
         c.customer_code, c.name AS customer_name, c.tax_id AS customer_tax_id,
         c.branch AS customer_branch, c.address AS customer_address,
         c.postal_code AS customer_postal_code,
         c.phone AS customer_phone, c.email AS customer_email,
         ct.name AS contact_name, ct.position AS contact_position,
         ct.phone AS contact_phone, ct.email AS contact_email,
         s.first_name_th AS salesperson_first_name, s.last_name_th AS salesperson_last_name,
         sc.mobile_phone AS salesperson_phone,
         q.quotation_no,
         bc.name AS billing_customer_name, bc.address AS billing_customer_address,
         bc.tax_id AS billing_customer_tax_id, bc.branch AS billing_customer_branch,
         bc.postal_code AS billing_customer_postal_code,
         sitec.name AS site_customer_name, sitec.address AS site_customer_address,
         sitec.postal_code AS site_customer_postal_code, sitec.phone AS site_customer_phone
       FROM sales_orders so
       LEFT JOIN customers c ON c.id = so.customer_id
       LEFT JOIN customer_contacts ct ON ct.id = so.contact_id
       LEFT JOIN staff s ON s.id = so.salesperson_id
       LEFT JOIN staff_contact sc ON sc.staff_id = s.id
       LEFT JOIN quotations q ON q.id = so.quotation_id
       LEFT JOIN customers bc ON bc.id = so.billing_customer_id
       LEFT JOIN customers sitec ON sitec.id = so.site_customer_id
       WHERE so.id = $1`,
      [id]
    );
    if (soRes.rows.length === 0) return res.status(404).json({ error: 'Sales Order not found' });

    const itemsRes = await query(
      `SELECT i.*, p.product_code, p.product_type
       FROM so_items i
       LEFT JOIN products p ON p.id = i.product_id
       WHERE i.so_id = $1
       ORDER BY i.display_order ASC, i.id ASC`,
      [id]
    );
    const attRes = await query(
      `SELECT id, file_name, original_name, file_size, mime_type, uploaded_at
       FROM so_attachments WHERE so_id = $1 ORDER BY id ASC`,
      [id]
    );
    res.json({ ...soRes.rows[0], items: itemsRes.rows, attachments: attRes.rows });
  } catch (err) {
    console.error('GET /sales-orders/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ----- POST create (transactional with items) ----- */
router.post('/', authenticate, async (req, res) => {
  const client = await getClient();
  try {
    const d = req.body || {};
    if (!d.customer_id) return res.status(400).json({ error: 'customer_id is required' });
    const itemsErr = validateItems(d.items);
    if (itemsErr) return res.status(400).json({ error: itemsErr });

    await client.query('BEGIN');

    // Generate SO number
    const soNumber = await genSoNumber(client, d.issue_date);

    // Compute money fields server-authoritatively
    const amts = computeAmounts(d);

    // Insert SO header
    const headerRes = await client.query(
      `INSERT INTO sales_orders (
         so_number, quotation_id, reference_no,
         customer_id, contact_id, salesperson_id,
         billing_customer_id, site_customer_id,
         issue_date, delivery_date, installation_date,
         project_name, notes,
         credit_days, payment_terms_notes,
         subtotal, discount_mode, discount_percent, discount_amount,
         amount_after_discount, vat_rate, vat_amount,
         wht_rate, wht_amount, grand_total, net_payable, price_includes_vat,
         status, created_by
       ) VALUES (
         $1, $2, $3,
         $4, $5, $6,
         $7, $8,
         $9, $10, $11,
         $12, $13,
         $14, $15,
         $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,
         'draft', $28
       ) RETURNING id`,
      [
        soNumber, d.quotation_id || null, d.reference_no || null,
        d.customer_id, d.contact_id || null, d.salesperson_id || null,
        d.billing_customer_id || null, d.site_customer_id || null,
        d.issue_date || new Date(), d.delivery_date || null, d.installation_date || null,
        d.project_name || null, d.notes || null,
        d.credit_days != null ? Number(d.credit_days) : null,
        d.payment_terms_notes || null,
        amts.subtotal, amts.discount_mode, amts.discount_percent, amts.discount_amount,
        amts.amount_after_discount, amts.vat_rate, amts.vat_amount,
        amts.wht_rate, amts.wht_amount, amts.grand_total, amts.net_payable, amts.price_includes_vat,
        req.user.id,
      ]
    );
    const soId = headerRes.rows[0].id;

    // Insert items
    for (let i = 0; i < d.items.length; i++) {
      const it = d.items[i];
      const totalPrice = round2(Number(it.quantity || 0) * Number(it.unit_price || 0));
      await client.query(
        `INSERT INTO so_items (
           so_id, display_order, product_id,
           product_name, product_brand, product_model, description, unit,
           quantity, unit_price, total_price
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
         )`,
        [
          soId, i, it.product_id || null,
          String(it.product_name || '').trim(),
          it.product_brand || null, it.product_model || null,
          it.description || null, it.unit || null,
          Number(it.quantity || 0), Number(it.unit_price || 0), totalPrice,
        ]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ id: soId, so_number: soNumber });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /sales-orders error:', err);
    // Friendly errors
    if (err.code === '23505' && err.constraint === 'uq_so_one_per_quotation') {
      return res.status(409).json({ error: 'ใบเสนอราคานี้มี SO อยู่แล้ว (1 QT = 1 SO)' });
    }
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ----- PUT/PATCH update (only when status='draft') ----- */
const updateSO = async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const d = req.body || {};

    // Check status
    const cur = await client.query(`SELECT status FROM sales_orders WHERE id = $1`, [id]);
    if (cur.rows.length === 0) return res.status(404).json({ error: 'Sales Order not found' });
    if (cur.rows[0].status !== 'draft') {
      return res.status(400).json({ error: 'แก้ไขได้เฉพาะ SO ที่อยู่ในสถานะ draft' });
    }

    if (!d.customer_id) return res.status(400).json({ error: 'customer_id is required' });
    const itemsErr = validateItems(d.items);
    if (itemsErr) return res.status(400).json({ error: itemsErr });

    await client.query('BEGIN');

    const amts = computeAmounts(d);

    // Update header
    await client.query(
      `UPDATE sales_orders SET
         reference_no = $1,
         customer_id = $2, contact_id = $3, salesperson_id = $4,
         billing_customer_id = $5, site_customer_id = $6,
         issue_date = $7, delivery_date = $8, installation_date = $9,
         project_name = $10, notes = $11,
         credit_days = $12, payment_terms_notes = $13,
         subtotal = $14, discount_mode = $15, discount_percent = $16, discount_amount = $17,
         amount_after_discount = $18, vat_rate = $19, vat_amount = $20,
         wht_rate = $21, wht_amount = $22, grand_total = $23, net_payable = $24,
         price_includes_vat = $25, updated_at = NOW()
       WHERE id = $26`,
      [
        d.reference_no || null,
        d.customer_id, d.contact_id || null, d.salesperson_id || null,
        d.billing_customer_id || null, d.site_customer_id || null,
        d.issue_date || new Date(), d.delivery_date || null, d.installation_date || null,
        d.project_name || null, d.notes || null,
        d.credit_days != null ? Number(d.credit_days) : null,
        d.payment_terms_notes || null,
        amts.subtotal, amts.discount_mode, amts.discount_percent, amts.discount_amount,
        amts.amount_after_discount, amts.vat_rate, amts.vat_amount,
        amts.wht_rate, amts.wht_amount, amts.grand_total, amts.net_payable, amts.price_includes_vat,
        id,
      ]
    );

    // Replace items: DELETE + INSERT
    await client.query(`DELETE FROM so_items WHERE so_id = $1`, [id]);
    for (let i = 0; i < d.items.length; i++) {
      const it = d.items[i];
      const totalPrice = round2(Number(it.quantity || 0) * Number(it.unit_price || 0));
      await client.query(
        `INSERT INTO so_items (
           so_id, display_order, product_id,
           product_name, product_brand, product_model, description, unit,
           quantity, unit_price, total_price
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
         )`,
        [
          id, i, it.product_id || null,
          String(it.product_name || '').trim(),
          it.product_brand || null, it.product_model || null,
          it.description || null, it.unit || null,
          Number(it.quantity || 0), Number(it.unit_price || 0), totalPrice,
        ]
      );
    }

    await client.query('COMMIT');
    res.json({ id: Number(id), success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`${req.method} /sales-orders/:id error:`, err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};
router.put('/:id', authenticate, updateSO);
router.patch('/:id', authenticate, updateSO);  // alias per lesson 10.11

/* ----- POST /:id/cancel — mark as cancelled with reason ----- */
router.post('/:id/cancel', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const reason = req.body?.reason || null;

    const cur = await query(`SELECT status FROM sales_orders WHERE id = $1`, [id]);
    if (cur.rows.length === 0) return res.status(404).json({ error: 'Sales Order not found' });
    if (cur.rows[0].status === 'cancelled') {
      return res.status(400).json({ error: 'SO นี้ถูกยกเลิกแล้ว' });
    }
    if (cur.rows[0].status === 'approved' || cur.rows[0].status === 'completed') {
      return res.status(400).json({
        error: 'ยกเลิก SO ที่ approved/completed แล้วไม่ได้ — ต้อง unapprove ก่อน (Phase 3.3D)'
      });
    }

    await query(
      `UPDATE sales_orders SET
         status = 'cancelled', cancel_reason = $1, cancelled_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [reason, id]
    );
    res.json({ id: Number(id), status: 'cancelled' });
  } catch (err) {
    console.error('POST /sales-orders/:id/cancel error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ----- DELETE /:id (only draft) ----- */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const cur = await query(`SELECT status FROM sales_orders WHERE id = $1`, [id]);
    if (cur.rows.length === 0) return res.status(404).json({ error: 'Sales Order not found' });
    if (cur.rows[0].status !== 'draft') {
      return res.status(400).json({ error: 'ลบได้เฉพาะ SO ที่อยู่ในสถานะ draft' });
    }
    await query(`DELETE FROM sales_orders WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /sales-orders/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ===== Attachments endpoints ===== */

/* GET /:id/attachments — list attachments */
router.get('/:id/attachments', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await query(
      `SELECT id, file_name, original_name, file_size, mime_type, uploaded_at
       FROM so_attachments WHERE so_id = $1 ORDER BY id ASC`,
      [id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error('GET /sales-orders/:id/attachments error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* POST /:id/attachments — upload (multipart, field name: 'file') */
router.post('/:id/attachments', authenticate, soUpload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'no file uploaded' });
    const display = (req.body?.file_name || req.file.originalname).trim();

    // Verify SO exists
    const cur = await query(`SELECT id FROM sales_orders WHERE id = $1`, [id]);
    if (cur.rows.length === 0) {
      // Cleanup uploaded file
      try { fs.unlinkSync(req.file.path); } catch (_) {}
      return res.status(404).json({ error: 'Sales Order not found' });
    }

    // Store relative path (uploads/so/...)
    const relPath = path.relative(uploadsBaseDir, req.file.path).replace(/\\/g, '/');

    const ins = await query(
      `INSERT INTO so_attachments (so_id, file_name, original_name, file_path, file_size, mime_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, file_name, original_name, file_size, mime_type, uploaded_at`,
      [id, display, req.file.originalname, relPath, req.file.size, req.file.mimetype, req.user.id]
    );
    res.status(201).json(ins.rows[0]);
  } catch (err) {
    console.error('POST /sales-orders/:id/attachments error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* GET /attachments/:attId/download — download file */
router.get('/attachments/:attId/download', authenticate, async (req, res) => {
  try {
    const { attId } = req.params;
    const r = await query(
      `SELECT file_path, original_name, mime_type FROM so_attachments WHERE id = $1`,
      [attId]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Attachment not found' });
    const att = r.rows[0];
    const fullPath = path.join(uploadsBaseDir, att.file_path);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File missing on disk' });
    res.setHeader('Content-Type', att.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(att.original_name || 'file')}"`);
    fs.createReadStream(fullPath).pipe(res);
  } catch (err) {
    console.error('GET /sales-orders/attachments/:attId/download error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* DELETE /attachments/:attId — remove attachment */
router.delete('/attachments/:attId', authenticate, async (req, res) => {
  try {
    const { attId } = req.params;
    const r = await query(`SELECT file_path FROM so_attachments WHERE id = $1`, [attId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Attachment not found' });

    // Try delete file (best-effort)
    try {
      const fullPath = path.join(uploadsBaseDir, r.rows[0].file_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch (_) {}

    await query(`DELETE FROM so_attachments WHERE id = $1`, [attId]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /sales-orders/attachments/:attId error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
