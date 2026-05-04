// backend/src/routes/quotations.js
// Phase 3.2A — Quotation CRUD
// Phase 3.2B.1 — PDF Export endpoint
const express = require('express');
const { query, getClient } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const router = express.Router();

/* ───── Thai number → words (shared with PO/WHT) ───── */
const _DIGITS = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const _POSITIONS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
function _convertInt(n) {
  if (n === 0) return '';
  const s = String(n);
  const len = s.length;
  let result = '';
  for (let i = 0; i < len; i++) {
    const d = parseInt(s[i]);
    const pos = len - 1 - i;
    if (d === 0) continue;
    if (pos === 0 && d === 1 && len > 1) result += 'เอ็ด';
    else if (pos === 1 && d === 2) result += 'ยี่' + _POSITIONS[pos];
    else if (pos === 1 && d === 1) result += _POSITIONS[pos];
    else result += _DIGITS[d] + _POSITIONS[pos];
  }
  return result;
}
function numToThaiWords(n) {
  if (!n || n === 0) return 'ศูนย์บาทถ้วน';
  const parts = Number(n).toFixed(2).split('.');
  const baht = parseInt(parts[0]);
  const satang = parseInt(parts[1]);
  let txt = _convertInt(baht) + 'บาท';
  if (satang === 0) txt += 'ถ้วน';
  else txt += _convertInt(satang) + 'สตางค์';
  return txt;
}

/* ===== Helper: gen quotation number (QT202605XXXX) ===== */
async function genQuotationNumber(client, issueDate) {
  const d = issueDate ? new Date(issueDate) : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const prefix = `QT${yyyy}${mm}`;
  const last = await client.query(
    `SELECT quotation_no FROM quotations
     WHERE quotation_no LIKE $1 ORDER BY quotation_no DESC LIMIT 1`,
    [`${prefix}%`]
  );
  let nextNum = 1;
  if (last.rows.length > 0 && last.rows[0].quotation_no) {
    const m = last.rows[0].quotation_no.match(new RegExp(`^${prefix}(\\d+)$`));
    if (m) nextNum = parseInt(m[1]) + 1;
  }
  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

/* ===== Helper: compute QT amounts (server-authoritative) =====
   ปัด 2 ตำแหน่งทศนิยม กัน floating point เพี้ยน */
function round2(n) { return Math.round(Number(n) * 100) / 100; }

function computeAmounts(input) {
  const items = input.items || [];
  const subtotal = items.reduce(
    (sum, it) => sum + Number(it.quantity || 0) * Number(it.unit_price || 0), 0
  );

  const discountMode = input.discount_mode || 'percent';
  let discountAmount = 0;
  let discountPercent = Number(input.discount_percent || 0);

  if (discountMode === 'percent') {
    discountAmount = round2(subtotal * discountPercent / 100);
  } else {
    discountAmount = round2(Number(input.discount_amount || 0));
    // ถ้า amount mode → percent เก็บไว้ 0 (UI ไม่ต้องใช้)
    discountPercent = 0;
  }
  // กันส่วนลดเกิน subtotal
  if (discountAmount > subtotal) discountAmount = subtotal;

  const amountAfterDiscount = round2(subtotal - discountAmount);
  const vatRate = Number(input.vat_rate || 0);
  const priceIncludesVat = !!input.price_includes_vat;

  // Logic:
  //  - price_includes_vat = false : ราคาไม่รวมภาษี → vat_amount = afterDisc * rate/100 + grand = afterDisc + vat
  //  - price_includes_vat = true  : ราคารวมภาษี → vat_amount = afterDisc * (rate/(100+rate)), grand = afterDisc
  let vatAmount, grandTotal;
  if (priceIncludesVat) {
    vatAmount = round2(amountAfterDiscount * vatRate / (100 + vatRate));
    grandTotal = amountAfterDiscount;
  } else {
    vatAmount = round2(amountAfterDiscount * vatRate / 100);
    grandTotal = round2(amountAfterDiscount + vatAmount);
  }

  // WHT: คำนวณบนฐาน amount_after_discount (ก่อน VAT) ตามมาตรฐาน
  const whtRate = Number(input.wht_rate || 0);
  const whtAmount = round2(amountAfterDiscount * whtRate / 100);
  const netPayable = round2(grandTotal - whtAmount);

  return {
    subtotal: round2(subtotal),
    discount_mode: discountMode,
    discount_percent: discountPercent,
    discount_amount: discountAmount,
    amount_after_discount: amountAfterDiscount,
    vat_rate: vatRate,
    vat_amount: vatAmount,
    grand_total: grandTotal,
    wht_rate: whtRate,
    wht_amount: whtAmount,
    net_payable: netPayable,
  };
}

/* ===== Helper: derive effective status (auto-expire) =====
   ไม่แตะ DB — แค่ส่งกลับใน response */
function effectiveStatus(row) {
  if (!row) return null;
  if (row.status === 'draft' || row.status === 'sent') {
    if (row.valid_until && new Date(row.valid_until) < new Date(new Date().toDateString())) {
      // expire เฉพาะ draft/sent — accepted/rejected ไม่เปลี่ยน
      if (row.status === 'sent') return 'expired';
    }
  }
  return row.status;
}

/* ========================================
   QUOTATIONS
   ======================================== */

/* ----- LIST quotations ----- */
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, status, customer_id } = req.query;
    const params = [];
    const conditions = [];

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(q.quotation_no ILIKE $${idx} OR q.project_name ILIKE $${idx} OR q.reference_no ILIKE $${idx} OR c.name ILIKE $${idx})`);
    }
    if (status) {
      params.push(status);
      conditions.push(`q.status = $${params.length}`);
    }
    if (customer_id) {
      params.push(customer_id);
      conditions.push(`q.customer_id = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
      `SELECT
         q.*,
         c.name AS customer_name,
         c.customer_code,
         s.first_name_th AS salesperson_first_name,
         s.last_name_th AS salesperson_last_name
       FROM quotations q
       LEFT JOIN customers c ON c.id = q.customer_id
       LEFT JOIN staff s ON s.id = q.salesperson_id
       ${whereClause}
       ORDER BY q.id DESC`,
      params
    );

    // เพิ่ม effective_status (auto-expire)
    const rows = result.rows.map(r => ({ ...r, effective_status: effectiveStatus(r) }));
    res.json(rows);
  } catch (err) {
    console.error('GET /quotations error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ----- GET quotation by id (รวม items + customer + contact + salesperson) ----- */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const qRes = await query(
      `SELECT
         q.*,
         c.customer_code, c.name AS customer_name, c.tax_id AS customer_tax_id,
         c.branch AS customer_branch, c.address AS customer_address,
         c.postal_code AS customer_postal_code,
         c.phone AS customer_phone, c.email AS customer_email,
         ct.name AS contact_name, ct.position AS contact_position,
         ct.phone AS contact_phone, ct.email AS contact_email,
         s.first_name_th AS salesperson_first_name, s.last_name_th AS salesperson_last_name,
         sc.mobile_phone AS salesperson_phone
       FROM quotations q
       LEFT JOIN customers c ON c.id = q.customer_id
       LEFT JOIN customer_contacts ct ON ct.id = q.contact_id
       LEFT JOIN staff s ON s.id = q.salesperson_id
       LEFT JOIN staff_contact sc ON sc.staff_id = s.id
       WHERE q.id = $1`,
      [id]
    );
    if (qRes.rows.length === 0) return res.status(404).json({ error: 'Quotation not found' });

    const itemsRes = await query(
      `SELECT i.*, p.product_code, p.product_type
       FROM quotation_items i
       LEFT JOIN products p ON p.id = i.product_id
       WHERE i.quotation_id = $1
       ORDER BY i.display_order ASC, i.id ASC`,
      [id]
    );

    const row = qRes.rows[0];
    res.json({
      ...row,
      effective_status: effectiveStatus(row),
      items: itemsRes.rows,
    });
  } catch (err) {
    console.error('GET /quotations/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ----- CREATE quotation ----- */
router.post('/', authenticate, async (req, res) => {
  const client = await getClient();
  try {
    const d = req.body || {};
    if (!d.customer_id) return res.status(400).json({ error: 'customer_id is required' });
    if (!d.items || d.items.length === 0) {
      return res.status(400).json({ error: 'ต้องมีรายการสินค้าอย่างน้อย 1 รายการ' });
    }
    // Validate items
    for (const it of d.items) {
      if (!it.product_name || !String(it.product_name).trim()) {
        return res.status(400).json({ error: 'ทุกรายการต้องมีชื่อสินค้า' });
      }
    }

    await client.query('BEGIN');

    // Compute amounts (server-authoritative — ไม่เชื่อ frontend)
    const calc = computeAmounts(d);

    // Compute valid_until
    const issueDate = d.issue_date ? new Date(d.issue_date) : new Date();
    const validDays = Number(d.valid_days || 30);
    const validUntil = new Date(issueDate.getTime() + validDays * 86400000);

    const quotationNo = await genQuotationNumber(client, issueDate);

    const insertRes = await client.query(
      `INSERT INTO quotations (
         quotation_no, issue_date, valid_days, valid_until, credit_days,
         customer_id, contact_id, salesperson_id,
         project_name, reference_no, price_includes_vat,
         discount_mode, discount_percent, discount_amount,
         vat_rate, vat_amount, wht_rate, wht_amount,
         subtotal, amount_after_discount, grand_total, net_payable,
         notes, status, created_by
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8,
         $9, $10, $11,
         $12, $13, $14,
         $15, $16, $17, $18,
         $19, $20, $21, $22,
         $23, COALESCE($24, 'draft'), $25
       ) RETURNING *`,
      [
        quotationNo, issueDate, validDays, validUntil, Number(d.credit_days || 0),
        d.customer_id, d.contact_id || null, d.salesperson_id || null,
        d.project_name || null, d.reference_no || null, !!d.price_includes_vat,
        calc.discount_mode, calc.discount_percent, calc.discount_amount,
        calc.vat_rate, calc.vat_amount, calc.wht_rate, calc.wht_amount,
        calc.subtotal, calc.amount_after_discount, calc.grand_total, calc.net_payable,
        d.notes || null, d.status, req.user.id
      ]
    );
    const qt = insertRes.rows[0];

    // Insert items
    for (let idx = 0; idx < d.items.length; idx++) {
      const it = d.items[idx];
      const lineTotal = round2(Number(it.quantity || 0) * Number(it.unit_price || 0));
      await client.query(
        `INSERT INTO quotation_items (
           quotation_id, display_order,
           product_id, product_name, product_model, product_brand, description,
           quantity, unit, unit_price, total_price
         ) VALUES (
           $1, $2,
           $3, $4, $5, $6, $7,
           $8, $9, $10, $11
         )`,
        [
          qt.id, idx,
          it.product_id || null,
          String(it.product_name).trim(),
          it.product_model || null, it.product_brand || null,
          it.description || null,
          Number(it.quantity || 1),
          it.unit || null,
          Number(it.unit_price || 0),
          lineTotal,
        ]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ ...qt, effective_status: effectiveStatus(qt) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /quotations error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ----- UPDATE quotation (replace items) ----- */
const updateQuotation = async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const d = req.body || {};
    if (!d.customer_id) return res.status(400).json({ error: 'customer_id is required' });
    if (!d.items || d.items.length === 0) {
      return res.status(400).json({ error: 'ต้องมีรายการสินค้าอย่างน้อย 1 รายการ' });
    }
    for (const it of d.items) {
      if (!it.product_name || !String(it.product_name).trim()) {
        return res.status(400).json({ error: 'ทุกรายการต้องมีชื่อสินค้า' });
      }
    }

    await client.query('BEGIN');

    const exist = await client.query(`SELECT id FROM quotations WHERE id = $1`, [id]);
    if (exist.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Quotation not found' });
    }

    const calc = computeAmounts(d);

    const issueDate = d.issue_date ? new Date(d.issue_date) : new Date();
    const validDays = Number(d.valid_days || 30);
    const validUntil = new Date(issueDate.getTime() + validDays * 86400000);

    const updateRes = await client.query(
      `UPDATE quotations SET
         issue_date = $1, valid_days = $2, valid_until = $3, credit_days = $4,
         customer_id = $5, contact_id = $6, salesperson_id = $7,
         project_name = $8, reference_no = $9, price_includes_vat = $10,
         discount_mode = $11, discount_percent = $12, discount_amount = $13,
         vat_rate = $14, vat_amount = $15, wht_rate = $16, wht_amount = $17,
         subtotal = $18, amount_after_discount = $19, grand_total = $20, net_payable = $21,
         notes = $22,
         status = COALESCE($23, status),
         updated_at = NOW()
       WHERE id = $24
       RETURNING *`,
      [
        issueDate, validDays, validUntil, Number(d.credit_days || 0),
        d.customer_id, d.contact_id || null, d.salesperson_id || null,
        d.project_name || null, d.reference_no || null, !!d.price_includes_vat,
        calc.discount_mode, calc.discount_percent, calc.discount_amount,
        calc.vat_rate, calc.vat_amount, calc.wht_rate, calc.wht_amount,
        calc.subtotal, calc.amount_after_discount, calc.grand_total, calc.net_payable,
        d.notes || null, d.status, id,
      ]
    );

    // Replace items: delete + insert (atomic)
    await client.query(`DELETE FROM quotation_items WHERE quotation_id = $1`, [id]);
    for (let idx = 0; idx < d.items.length; idx++) {
      const it = d.items[idx];
      const lineTotal = round2(Number(it.quantity || 0) * Number(it.unit_price || 0));
      await client.query(
        `INSERT INTO quotation_items (
           quotation_id, display_order,
           product_id, product_name, product_model, product_brand, description,
           quantity, unit, unit_price, total_price
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          id, idx,
          it.product_id || null,
          String(it.product_name).trim(),
          it.product_model || null, it.product_brand || null,
          it.description || null,
          Number(it.quantity || 1),
          it.unit || null,
          Number(it.unit_price || 0),
          lineTotal,
        ]
      );
    }

    await client.query('COMMIT');
    const qt = updateRes.rows[0];
    res.json({ ...qt, effective_status: effectiveStatus(qt) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PUT /quotations/:id error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};
router.put('/:id', authenticate, updateQuotation);
router.patch('/:id', authenticate, updateQuotation);  // alias (กัน method mismatch — section 10.11)

/* ----- CHANGE STATUS ----- */
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const validStatuses = ['draft', 'sent', 'accepted', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status ต้องเป็น ${validStatuses.join('/')}` });
    }
    // หมายเหตุ: 'expired' เป็น computed status เท่านั้น ไม่ตั้งใน DB

    const result = await query(
      `UPDATE quotations SET status = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Quotation not found' });
    const qt = result.rows[0];
    res.json({ ...qt, effective_status: effectiveStatus(qt) });
  } catch (err) {
    console.error('PUT status error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ----- DELETE quotation ----- */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `DELETE FROM quotations WHERE id = $1 RETURNING id`, [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Quotation not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /quotations/:id error:', err);
    if (err.code === '23503') {
      return res.status(400).json({
        error: 'ลบไม่ได้: มีเอกสาร (Sales Order/Invoice) อ้างอิงอยู่'
      });
    }
    res.status(500).json({ error: err.message });
  }
});

/* ========== GENERATE QUOTATION PDF (Phase 3.2B.1) ========== */
router.get('/:id/pdf', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    // ?stamp=1 (default) | ?stamp=0
    const showStamp = req.query.stamp !== '0';

    const qRes = await query(
      `SELECT
         q.*,
         c.customer_code, c.name AS customer_name, c.tax_id AS customer_tax_id,
         c.branch AS customer_branch, c.address AS customer_address,
         c.postal_code AS customer_postal_code,
         c.phone AS customer_phone, c.email AS customer_email,
         ct.name AS contact_name, ct.position AS contact_position,
         ct.phone AS contact_phone, ct.email AS contact_email,
         s.first_name_th AS salesperson_first_name, s.last_name_th AS salesperson_last_name,
         sc.mobile_phone AS salesperson_phone
       FROM quotations q
       LEFT JOIN customers c ON c.id = q.customer_id
       LEFT JOIN customer_contacts ct ON ct.id = q.contact_id
       LEFT JOIN staff s ON s.id = q.salesperson_id
       LEFT JOIN staff_contact sc ON sc.staff_id = s.id
       WHERE q.id = $1`,
      [id]
    );
    if (qRes.rows.length === 0) return res.status(404).json({ error: 'Quotation not found' });

    const itemsRes = await query(
      `SELECT i.*,
              p.product_code, p.product_type,
              p.brand AS p_brand, p.model AS p_model
       FROM quotation_items i
       LEFT JOIN products p ON p.id = i.product_id
       WHERE i.quotation_id = $1
       ORDER BY i.display_order ASC, i.id ASC`,
      [id]
    );

    const qt = qRes.rows[0];
    const pdfData = {
      ...qt,
      // Force numeric for safety
      subtotal: Number(qt.subtotal || 0),
      amount_after_discount: Number(qt.amount_after_discount || 0),
      discount_amount: Number(qt.discount_amount || 0),
      discount_percent: Number(qt.discount_percent || 0),
      vat_rate: Number(qt.vat_rate || 0),
      vat_amount: Number(qt.vat_amount || 0),
      wht_rate: Number(qt.wht_rate || 0),
      wht_amount: Number(qt.wht_amount || 0),
      grand_total: Number(qt.grand_total || 0),
      net_payable: Number(qt.net_payable || 0),
      grand_total_words: numToThaiWords(Number(qt.grand_total || 0)),
      show_stamp: showStamp,
      items: itemsRes.rows.map(it => ({
        product_id: it.product_id,
        product_name: it.product_name || '',
        product_brand: it.product_brand || it.p_brand || '',
        product_model: it.product_model || it.p_model || '',
        description: it.description || '',
        unit: it.unit || '',
        quantity: Number(it.quantity || 0),
        unit_price: Number(it.unit_price || 0),
        line_total: Number(it.total_price || 0),
      })),
    };

    const tmpFile = path.join(os.tmpdir(), `qt_${qt.quotation_no}_${Date.now()}.pdf`);
    const scriptPath = path.join(__dirname, '..', 'utils', 'generate_quotation_pdf.py');
    const tmpJson = tmpFile + '.json';
    fs.writeFileSync(tmpJson, JSON.stringify(pdfData));
    execSync(`cat "${tmpJson}" | python3 "${scriptPath}" "${tmpFile}"`);
    fs.unlinkSync(tmpJson);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${qt.quotation_no}.pdf"`);
    const stream = fs.createReadStream(tmpFile);
    stream.pipe(res);
    stream.on('end', () => fs.unlink(tmpFile, () => {}));
  } catch (err) {
    console.error('GET /quotations/:id/pdf error:', err);
    res.status(500).json({ error: 'ไม่สามารถสร้าง PDF ได้: ' + err.message });
  }
});

module.exports = router;
