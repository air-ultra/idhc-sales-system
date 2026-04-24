// backend/src/routes/purchaseOrders.js
const express = require('express');
const multer = require('multer');
const { query, getClient } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const router = express.Router();

// ───── Document upload config ─────
const uploadDir = '/app/uploads/po';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const poDir = path.join(uploadDir, String(req.params.id));
    if (!fs.existsSync(poDir)) fs.mkdirSync(poDir, { recursive: true });
    cb(null, poDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9\u0E00-\u0E7F\-_ ]/g, '').substring(0, 60);
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

// ───── Thai number → words (shared with WHT) ─────
const DIGITS = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const POSITIONS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

function numToThaiWords(n) {
  if (n === 0) return 'ศูนย์บาทถ้วน';
  const parts = n.toFixed(2).split('.');
  const baht = parseInt(parts[0]);
  const satang = parseInt(parts[1]);
  let txt = convertInt(baht) + 'บาท';
  if (satang === 0) txt += 'ถ้วน';
  else txt += convertInt(satang) + 'สตางค์';
  return txt;
}
function convertInt(n) {
  if (n === 0) return '';
  const s = String(n);
  const len = s.length;
  let result = '';
  for (let i = 0; i < len; i++) {
    const d = parseInt(s[i]);
    const pos = len - 1 - i;
    if (d === 0) continue;
    if (pos === 0 && d === 1 && len > 1) result += 'เอ็ด';
    else if (pos === 1 && d === 2) result += 'ยี่' + POSITIONS[pos];
    else if (pos === 1 && d === 1) result += POSITIONS[pos];
    else result += DIGITS[d] + POSITIONS[pos];
  }
  return result;
}

/* ========== GET all POs ========== */
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        po.*,
        s.name AS supplier_name,
        s.code AS supplier_code,
        COALESCE((SELECT COUNT(*) FROM po_items WHERE po_id = po.id), 0) AS item_count,
        CONCAT(st.first_name_th, ' ', st.last_name_th) AS ordered_by_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      LEFT JOIN staff st ON st.id = po.ordered_by_staff_id
      ORDER BY po.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /purchase-orders error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== GET PO by id ========== */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const po = await query(
      `SELECT po.*,
              s.name AS supplier_name, s.code AS supplier_code,
              s.tax_id AS supplier_tax_id, s.address AS supplier_address,
              s.phone AS supplier_phone,
              CONCAT(st.first_name_th, ' ', st.last_name_th) AS ordered_by_name,
              wht.doc_no AS withholding_doc_no
       FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id
       LEFT JOIN staff st ON st.id = po.ordered_by_staff_id
       LEFT JOIN withholding_tax wht ON wht.id = po.withholding_id
       WHERE po.id = $1`,
      [id]
    );
    if (po.rows.length === 0) return res.status(404).json({ error: 'PO not found' });

    const items = await query(
      `SELECT pi.*,
              p.product_code, p.name AS product_name,
              p.model AS product_model, p.product_type,
              p.default_unit AS product_unit
       FROM po_items pi
       LEFT JOIN products p ON p.id = pi.product_id
       WHERE pi.po_id = $1
       ORDER BY pi.id`,
      [id]
    );

    res.json({ ...po.rows[0], items: items.rows });
  } catch (err) {
    console.error('GET /purchase-orders/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== CREATE PO ========== */
router.post('/', authenticate, async (req, res) => {
  const client = await getClient();
  try {
    const {
      supplier_id, po_date, notes, vat_rate, items,
      ordered_by_staff_id, job_name, credit_days, wht_rate
    } = req.body;

    if (!supplier_id) return res.status(400).json({ error: 'supplier_id is required' });
    if (!items || items.length === 0) return res.status(400).json({ error: 'items are required' });

    await client.query('BEGIN');

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `PO${yyyy}${mm}`;
    const last = await client.query(
      `SELECT po_number FROM purchase_orders
       WHERE po_number LIKE $1 ORDER BY po_number DESC LIMIT 1`,
      [`${prefix}%`]
    );
    let nextNum = 1;
    if (last.rows.length > 0 && last.rows[0].po_number) {
      const m = last.rows[0].po_number.match(new RegExp(`^${prefix}(\\d+)$`));
      if (m) nextNum = parseInt(m[1]) + 1;
    }
    const po_number = `${prefix}${String(nextNum).padStart(4, '0')}`;

    let total_amount = 0;
    items.forEach(it => {
      total_amount += Number(it.quantity || 0) * Number(it.unit_price || 0);
    });
    const vat_amount = total_amount * (Number(vat_rate || 0) / 100);
    const grand_total = total_amount + vat_amount;
    const wht_amount = total_amount * (Number(wht_rate || 0) / 100);

    // คำนวณ due_date
    const poDateObj = new Date(po_date || new Date());
    const credits = Number(credit_days || 0);
    const dueDate = new Date(poDateObj.getTime() + credits * 86400000);

    const poRes = await client.query(
      `INSERT INTO purchase_orders
         (po_number, supplier_id, po_date, notes, vat_rate,
          total_amount, vat_amount, grand_total, status, created_by,
          ordered_by_staff_id, job_name, credit_days, due_date, wht_rate, wht_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9,
               $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [po_number, supplier_id, po_date || new Date(), notes || null,
       vat_rate || 0, total_amount, vat_amount, grand_total, req.user.id,
       ordered_by_staff_id || null, job_name || null,
       credits, dueDate, wht_rate || 0, wht_amount]
    );
    const po = poRes.rows[0];

    for (const it of items) {
      await client.query(
        `INSERT INTO po_items (po_id, product_id, unit, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [po.id, it.product_id, it.unit || 'ชิ้น',
         it.quantity, it.unit_price,
         Number(it.quantity) * Number(it.unit_price)]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(po);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /purchase-orders error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ========== APPROVE PO ========== */
router.post('/:id/approve', authenticate, async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    await client.query('BEGIN');

    // เช็กว่า PO มี item ที่ไม่ใช่ service หรือเปล่า
    const typeCheck = await client.query(
      `SELECT COUNT(*) FILTER (WHERE p.product_type != 'service') AS non_service_count
       FROM po_items pi
       LEFT JOIN products p ON p.id = pi.product_id
       WHERE pi.po_id = $1`, [id]
    );
    const nonServiceCount = parseInt(typeCheck.rows[0].non_service_count);

    // ถ้าทุกอย่างเป็น service → ข้ามไป received เลย
    const newStatus = nonServiceCount === 0 ? 'received' : 'approved';

    let result;
    if (newStatus === 'received') {
      // PO บริการ → approved + received ในคราวเดียว
      result = await client.query(
        `UPDATE purchase_orders
         SET status = 'received',
             approved_by = $1, approved_at = NOW(),
             received_by = $1, received_at = NOW(),
             updated_at = NOW()
         WHERE id = $2 AND status = 'draft'
         RETURNING *`,
        [req.user.id, id]
      );

      // update received_qty ให้เท่า quantity ของทุก item
      if (result.rows.length > 0) {
        await client.query(
          `UPDATE po_items SET received_qty = quantity WHERE po_id = $1`,
          [id]
        );
      }
    } else {
      result = await client.query(
        `UPDATE purchase_orders
         SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
         WHERE id = $2 AND status = 'draft'
         RETURNING *`,
        [req.user.id, id]
      );
    }

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'PO ไม่พบ หรือสถานะไม่ใช่ draft' });
    }

    await client.query('COMMIT');
    res.json({ ...result.rows[0], auto_received: newStatus === 'received' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /purchase-orders/:id/approve error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ========== RECEIVE PO ========== */
router.post('/:id/receive', authenticate, async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'items are required' });
    }

    await client.query('BEGIN');

    const poCheck = await client.query(
      `SELECT * FROM purchase_orders WHERE id = $1 FOR UPDATE`, [id]
    );
    if (poCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'PO not found' });
    }
    const po = poCheck.rows[0];
    if (po.status !== 'approved') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `PO สถานะ "${po.status}" ยังรับสินค้าไม่ได้ (ต้อง approved)` });
    }

    const poItemsRes = await client.query(
      `SELECT pi.*, p.product_type, p.name AS product_name, p.product_code
       FROM po_items pi
       LEFT JOIN products p ON p.id = pi.product_id
       WHERE pi.po_id = $1`,
      [id]
    );
    const poItemsMap = {};
    poItemsRes.rows.forEach(it => { poItemsMap[it.id] = it; });

    for (const it of items) {
      const poItem = poItemsMap[it.po_item_id];
      if (!poItem) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `ไม่พบ po_item_id ${it.po_item_id}` });
      }

      const productType = poItem.product_type || 'stock';
      const qtyOrdered = Number(poItem.quantity);
      const unitCost = Number(poItem.unit_price);

      if (productType === 'stock') {
        const serials = it.serials || [];
        if (serials.length !== qtyOrdered) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: `สินค้า ${poItem.product_code} ต้องมี Serial ${qtyOrdered} ชิ้น (ส่งมา ${serials.length})`
          });
        }

        for (let i = 0; i < serials.length; i++) {
          if (!serials[i].serial_no || !String(serials[i].serial_no).trim()) {
            await client.query('ROLLBACK');
            return res.status(400).json({
              error: `สินค้า ${poItem.product_code} ชิ้นที่ ${i + 1}: Serial ว่าง`
            });
          }
        }

        const seen = new Set();
        for (const s of serials) {
          const sn = String(s.serial_no).trim();
          if (seen.has(sn)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Serial ซ้ำใน PO นี้: ${sn}` });
          }
          seen.add(sn);
        }

        for (const s of serials) {
          const sn = String(s.serial_no).trim();
          const dup = await client.query(
            `SELECT id FROM product_serials WHERE product_id = $1 AND serial_no = $2`,
            [poItem.product_id, sn]
          );
          if (dup.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
              error: `Serial "${sn}" มีอยู่แล้วในระบบ (สินค้า ${poItem.product_code})`
            });
          }
        }

        for (const s of serials) {
          await client.query(
            `INSERT INTO product_serials
               (product_id, serial_no, mac_address, status, po_id, cost_price, notes, created_at)
             VALUES ($1, $2, $3, 'available', $4, $5, $6, NOW())`,
            [
              poItem.product_id,
              String(s.serial_no).trim(),
              s.mac_address ? String(s.mac_address).trim() : null,
              id,
              unitCost,
              s.notes || null
            ]
          );
        }

        await client.query(
          `UPDATE products
           SET stock_qty = CASE WHEN stock_qty IS NULL OR stock_qty::text = 'NaN' THEN 0 ELSE stock_qty END + $1,
               updated_at = NOW()
           WHERE id = $2`,
          [qtyOrdered, poItem.product_id]
        );
        await client.query(
          `UPDATE po_items SET received_qty = $1 WHERE id = $2`,
          [qtyOrdered, poItem.id]
        );

        try {
          await client.query(
            `INSERT INTO stock_movements
               (product_id, movement_type, quantity, reference_type, reference_id, notes, created_by, created_at)
             VALUES ($1, 'in', $2, 'po', $3, $4, $5, NOW())`,
            [poItem.product_id, qtyOrdered, id, `รับจาก PO ${po.po_number}`, req.user.id]
          );
        } catch (e) {
          console.warn('stock_movement log skipped:', e.message);
        }

      } else if (productType === 'non_stock') {
        await client.query(
          `UPDATE products
           SET stock_qty = CASE WHEN stock_qty IS NULL OR stock_qty::text = 'NaN' THEN 0 ELSE stock_qty END + $1,
               updated_at = NOW()
           WHERE id = $2`,
          [qtyOrdered, poItem.product_id]
        );
        await client.query(
          `UPDATE po_items SET received_qty = $1 WHERE id = $2`,
          [qtyOrdered, poItem.id]
        );

        try {
          await client.query(
            `INSERT INTO stock_movements
               (product_id, movement_type, quantity, reference_type, reference_id, notes, created_by, created_at)
             VALUES ($1, 'in', $2, 'po', $3, $4, $5, NOW())`,
            [poItem.product_id, qtyOrdered, id, `รับจาก PO ${po.po_number}`, req.user.id]
          );
        } catch (e) {
          console.warn('stock_movement log skipped:', e.message);
        }

      } else {
        await client.query(
          `UPDATE po_items SET received_qty = $1 WHERE id = $2`,
          [qtyOrdered, poItem.id]
        );
      }
    }

    await client.query(
      `UPDATE purchase_orders
       SET status = 'received', received_by = $1, received_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [req.user.id, id]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'รับสินค้าเรียบร้อย' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /purchase-orders/:id/receive error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ========== CANCEL PO ========== */
router.post('/:id/cancel', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `UPDATE purchase_orders
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND status IN ('draft', 'approved')
       RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'ยกเลิกไม่ได้' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('POST /purchase-orders/:id/cancel error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== DELETE PO ========== */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const check = await query(`SELECT status FROM purchase_orders WHERE id = $1`, [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'PO not found' });
    if (check.rows[0].status !== 'draft') {
      return res.status(400).json({ error: 'ลบได้เฉพาะ PO สถานะ draft' });
    }
    await query(`DELETE FROM purchase_orders WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /purchase-orders/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== UPDATE BILLING INFO ========== */
router.put('/:id/billing', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { bill_number, bill_date, credit_days, bill_notes } = req.body;

    // auto-calc due_date
    let due_date = null;
    if (bill_date) {
      const d = new Date(bill_date);
      d.setDate(d.getDate() + Number(credit_days || 0));
      due_date = d.toISOString().slice(0, 10);
    }

    const result = await query(
      `UPDATE purchase_orders SET
         bill_number = $1,
         bill_date = $2,
         credit_days = COALESCE($3, credit_days),
         due_date = COALESCE($4, due_date),
         bill_notes = $5,
         updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [bill_number || null, bill_date || null,
       credit_days !== undefined ? Number(credit_days) : null,
       due_date, bill_notes || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'PO not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /purchase-orders/:id/billing error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== UPDATE PAYMENT INFO ========== */
router.put('/:id/payment', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      payment_status, payment_date, payment_method,
      payment_reference, payment_amount, payment_notes
    } = req.body;

    const result = await query(
      `UPDATE purchase_orders SET
         payment_status = COALESCE($1, payment_status),
         payment_date = $2,
         payment_method = $3,
         payment_reference = $4,
         payment_amount = $5,
         payment_notes = $6,
         updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [payment_status || null, payment_date || null,
       payment_method || null, payment_reference || null,
       payment_amount !== undefined && payment_amount !== '' ? Number(payment_amount) : null,
       payment_notes || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'PO not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /purchase-orders/:id/payment error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== CREATE WITHHOLDING TAX FROM PO ========== */
router.post('/:id/withholding', authenticate, async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const {
      wht_rate, pnd_form, income_type, income_desc,
      issue_date, withhold_method
    } = req.body;

    await client.query('BEGIN');

    // ดึงข้อมูล PO + supplier
    const poRes = await client.query(
      `SELECT po.*, s.name AS supplier_name, s.tax_id AS supplier_tax_id,
              s.address AS supplier_address
       FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id
       WHERE po.id = $1`, [id]
    );
    if (poRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'PO not found' });
    }
    const po = poRes.rows[0];

    if (po.withholding_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'PO นี้สร้างใบหัก ณ ที่จ่ายไปแล้ว' });
    }

    // คำนวณยอด
    const income = Number(po.total_amount);
    const rate = Number(wht_rate || po.wht_rate || 3);
    const tax = income * (rate / 100);

    // gen doc_no
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `WHT${yyyy}${mm}`;
    const last = await client.query(
      `SELECT doc_no FROM withholding_tax
       WHERE doc_no LIKE $1 ORDER BY doc_no DESC LIMIT 1`,
      [`${prefix}%`]
    );
    let seq = 1;
    if (last.rows.length > 0) {
      const m = last.rows[0].doc_no.match(new RegExp(`^${prefix}(\\d+)$`));
      if (m) seq = parseInt(m[1]) + 1;
    }
    const doc_no = `${prefix}${String(seq).padStart(4, '0')}`;

    // insert withholding_tax
    const whtRes = await client.query(
      `INSERT INTO withholding_tax
         (doc_no, tax_year, issue_date,
          payer_name, payer_tax_id, payer_address,
          payee_name, payee_tax_id, payee_address,
          pnd_form, pnd_seq, income_type, income_desc,
          total_income, total_tax, withhold_method, tax_words,
          status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
               $10, 1, $11, $12, $13, $14, $15, $16, 'draft', $17)
       RETURNING *`,
      [
        doc_no, yyyy,
        issue_date || new Date(),
        'บริษัท ไอเดีย เฮ้าส์ เซ็นเตอร์ จำกัด (สำนักงานใหญ่)',
        '0105556022070',
        'เลขที่ 80 อาคาร เค.เอ.เอ็น.เพลส ห้องเลขที่ 104 ชั้น 1 ซ.นราธิวาสราชนครินทร์ 8 แขวงทุ่งวัดดอน เขตสาทร กรุงเทพฯ 10120',
        po.supplier_name,
        po.supplier_tax_id || '',
        po.supplier_address || '',
        pnd_form || 'ภ.ง.ด.3',
        income_type || 'ม.3 เตรส',
        income_desc || po.job_name || `ค่าจาก PO ${po.po_number}`,
        income, tax,
        withhold_method || 1,
        numToThaiWords(tax),
        req.user.id
      ]
    );
    const wht = whtRes.rows[0];

    // insert item
    await client.query(
      `INSERT INTO withholding_tax_items
         (wht_id, pay_date, description, income_amount, tax_amount, pnd_form, income_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [wht.id,
       issue_date || new Date(),
       income_desc || po.job_name || `ค่าจาก PO ${po.po_number}`,
       income, tax,
       pnd_form || 'ภ.ง.ด.3',
       income_type || 'ม.3 เตรส']
    );

    // link กลับไปที่ PO + update wht_rate/amount
    await client.query(
      `UPDATE purchase_orders
       SET withholding_id = $1,
           wht_rate = $2,
           wht_amount = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [wht.id, rate, tax, id]
    );

    await client.query('COMMIT');
    res.status(201).json({ ...wht, po_id: parseInt(id) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /purchase-orders/:id/withholding error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ========== GENERATE PO PDF ========== */
router.get('/:id/pdf', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const poRes = await query(
      `SELECT po.*,
              s.name AS supplier_name, s.tax_id AS supplier_tax_id,
              s.address AS supplier_address, s.phone AS supplier_phone,
              CONCAT(st.first_name_th, ' ', st.last_name_th) AS ordered_by_name
       FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id
       LEFT JOIN staff st ON st.id = po.ordered_by_staff_id
       WHERE po.id = $1`, [id]
    );
    if (poRes.rows.length === 0) return res.status(404).json({ error: 'PO not found' });
    const po = poRes.rows[0];

    const itemsRes = await query(
      `SELECT pi.*,
              p.product_code, p.name AS product_name,
              p.model AS product_model, p.default_unit
       FROM po_items pi
       LEFT JOIN products p ON p.id = pi.product_id
       WHERE pi.po_id = $1 ORDER BY pi.id`, [id]
    );

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('th-TH', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    }) : '';

    const totalAmount = Number(po.total_amount);
    const vatAmount = Number(po.vat_amount);
    const grandTotal = Number(po.grand_total);
    const whtAmount = Number(po.wht_amount || 0);
    const netPayment = grandTotal - whtAmount;

    const pdfData = {
      po_number: po.po_number,
      po_date: formatDate(po.po_date),
      credit_days: po.credit_days || 0,
      due_date: formatDate(po.due_date),
      ordered_by: po.ordered_by_name || '',
      job_name: po.job_name || '',

      // payer (our company)
      payer_name: 'บริษัท ไอเดีย เฮ้าส์ เซ็นเตอร์ จำกัด (สำนักงานใหญ่)',
      payer_address: 'เลขที่ 80 อาคาร เค.เอ.เอ็น.เพลส ห้องเลขที่ 104\nชั้น 1 ซอยนราธิวาสราชนครินทร์ 8 แขวงทุ่งวัดดอน เขตสาทร กรุงเทพฯ 10120',
      payer_tax_id: '0105556022070',
      payer_phone: '02-003-8359, 02-003-8462',
      payer_mobile: '086-358-3354',
      payer_fax: '02-286-1932',
      payer_website: 'www.ideas-house.com',

      // supplier
      supplier_name: po.supplier_name || '',
      supplier_address: po.supplier_address || '',
      supplier_tax_id: po.supplier_tax_id || '',

      // items
      items: itemsRes.rows.map((it, idx) => ({
        no: idx + 1,
        description: it.product_name + (it.product_model ? `\n${it.product_model}` : '') +
                     (po.job_name ? `\n${po.job_name}` : ''),
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        total: Number(it.total_price),
      })),

      // totals
      total_amount: totalAmount,
      vat_rate: Number(po.vat_rate || 0),
      vat_amount: vatAmount,
      grand_total: grandTotal,
      grand_total_words: numToThaiWords(grandTotal),
      wht_rate: Number(po.wht_rate || 0),
      wht_amount: whtAmount,
      net_payment: netPayment,
      show_wht: whtAmount > 0,
    };

    const tmpFile = path.join(os.tmpdir(), `po_${po.po_number}_${Date.now()}.pdf`);
    const scriptPath = path.join(__dirname, '..', 'utils', 'generate_po_pdf.py');
    const tmpJson = tmpFile + '.json';

    fs.writeFileSync(tmpJson, JSON.stringify(pdfData));
    execSync(`cat "${tmpJson}" | python3 "${scriptPath}" "${tmpFile}"`);
    fs.unlinkSync(tmpJson);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${po.po_number}.pdf"`);
    const stream = fs.createReadStream(tmpFile);
    stream.pipe(res);
    stream.on('end', () => fs.unlink(tmpFile, () => {}));
  } catch (err) {
    console.error('GET /purchase-orders/:id/pdf error:', err);
    res.status(500).json({ error: 'ไม่สามารถสร้าง PDF ได้: ' + err.message });
  }
});


/* ========== LIST DOCUMENTS ========== */
router.get('/:id/documents', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT d.*, u.username AS uploaded_by_name
       FROM po_documents d
       LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE d.po_id = $1
       ORDER BY d.uploaded_at DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /purchase-orders/:id/documents error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== UPLOAD DOCUMENT ========== */
router.post('/:id/documents', authenticate, upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'ไม่มีไฟล์แนบ' });

    const result = await query(
      `INSERT INTO po_documents
         (po_id, file_name, file_path, mime_type, file_size, notes, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, req.file.originalname, req.file.filename,
       req.file.mimetype, req.file.size,
       req.body.notes || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /purchase-orders/:id/documents error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== DOWNLOAD DOCUMENT ========== */
router.get('/:id/documents/:docId/download', authenticate, async (req, res) => {
  try {
    const { id, docId } = req.params;
    const result = await query(
      `SELECT * FROM po_documents WHERE id = $1 AND po_id = $2`,
      [docId, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'ไม่พบไฟล์' });

    const doc = result.rows[0];
    const filePath = path.join(uploadDir, String(id), doc.file_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'ไฟล์หายจาก server' });

    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(doc.file_name)}`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('GET /documents/:docId/download error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== DELETE DOCUMENT ========== */
router.delete('/:id/documents/:docId', authenticate, async (req, res) => {
  try {
    const { id, docId } = req.params;
    const result = await query(
      `SELECT * FROM po_documents WHERE id = $1 AND po_id = $2`,
      [docId, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'ไม่พบไฟล์' });

    const doc = result.rows[0];
    const filePath = path.join(uploadDir, String(id), doc.file_path);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) { console.warn('unlink:', e.message); }
    }

    await query(`DELETE FROM po_documents WHERE id = $1`, [docId]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /documents/:docId error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
