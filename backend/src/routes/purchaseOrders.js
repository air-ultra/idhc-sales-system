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
              wht.doc_no AS withholding_doc_no,
              cba.bank_name AS payment_bank_name,
              cba.branch AS payment_bank_branch,
              cba.account_number AS payment_account_number,
              cba.account_name AS payment_account_name
       FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id
       LEFT JOIN staff st ON st.id = po.ordered_by_staff_id
       LEFT JOIN withholding_tax wht ON wht.id = po.withholding_id
       LEFT JOIN company_bank_accounts cba ON cba.id = po.payment_bank_account_id
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

    // คำนวณ total + wht ระดับ item แล้ว sum
    let total_amount = 0;
    let wht_amount = 0;
    const itemsWithCalc = items.map(it => {
      const lineTotal = Number(it.quantity || 0) * Number(it.unit_price || 0);
      const itemWhtRate = Number(it.wht_rate || 0);
      const itemWhtAmount = +(lineTotal * itemWhtRate / 100).toFixed(2);
      total_amount += lineTotal;
      wht_amount += itemWhtAmount;
      return { ...it, line_total: lineTotal, wht_rate: itemWhtRate, wht_amount: itemWhtAmount };
    });
    const vat_amount = total_amount * (Number(vat_rate || 0) / 100);
    const grand_total = total_amount + vat_amount;

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
       credits, dueDate, 0, wht_amount]
    );
    const po = poRes.rows[0];

    for (const it of itemsWithCalc) {
      await client.query(
        `INSERT INTO po_items (po_id, product_id, unit, quantity, unit_price, total_price, description, wht_rate, wht_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [po.id, it.product_id, it.unit || 'ชิ้น',
         it.quantity, it.unit_price, it.line_total,
         it.description || null,
         it.wht_rate, it.wht_amount]
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

/* ========== UPDATE PO (only when status = 'draft') ========== */
router.put('/:id', authenticate, async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const {
      supplier_id, po_date, notes, vat_rate, items,
      ordered_by_staff_id, job_name, credit_days, wht_rate
    } = req.body;

    if (!supplier_id) return res.status(400).json({ error: 'supplier_id is required' });
    if (!items || items.length === 0) return res.status(400).json({ error: 'items are required' });

    await client.query('BEGIN');

    // เช็คว่า PO อยู่ใน status draft เท่านั้น
    const check = await client.query(
      `SELECT status FROM purchase_orders WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'PO not found' });
    }
    if (check.rows[0].status !== 'draft') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'แก้ไขได้เฉพาะ PO สถานะ "ร่าง" เท่านั้น' });
    }

    // คำนวณยอดใหม่ + wht ระดับ item
    let total_amount = 0;
    let wht_amount = 0;
    const itemsWithCalc = items.map(it => {
      const lineTotal = Number(it.quantity || 0) * Number(it.unit_price || 0);
      const itemWhtRate = Number(it.wht_rate || 0);
      const itemWhtAmount = +(lineTotal * itemWhtRate / 100).toFixed(2);
      total_amount += lineTotal;
      wht_amount += itemWhtAmount;
      return { ...it, line_total: lineTotal, wht_rate: itemWhtRate, wht_amount: itemWhtAmount };
    });
    const vat_amount = total_amount * (Number(vat_rate || 0) / 100);
    const grand_total = total_amount + vat_amount;

    // คำนวณ due_date ใหม่
    const poDateObj = new Date(po_date || new Date());
    const credits = Number(credit_days || 0);
    const dueDate = new Date(poDateObj.getTime() + credits * 86400000);

    // update header
    const updRes = await client.query(
      `UPDATE purchase_orders SET
         supplier_id = $1, po_date = $2, notes = $3, vat_rate = $4,
         total_amount = $5, vat_amount = $6, grand_total = $7,
         ordered_by_staff_id = $8, job_name = $9,
         credit_days = $10, due_date = $11, wht_rate = $12, wht_amount = $13,
         updated_at = NOW()
       WHERE id = $14 AND status = 'draft'
       RETURNING *`,
      [supplier_id, po_date || new Date(), notes || null, vat_rate || 0,
       total_amount, vat_amount, grand_total,
       ordered_by_staff_id || null, job_name || null,
       credits, dueDate, 0, wht_amount, id]
    );

    if (updRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'อัปเดตไม่สำเร็จ' });
    }

    // ลบ items เก่าทั้งหมด แล้ว insert ใหม่
    await client.query(`DELETE FROM po_items WHERE po_id = $1`, [id]);

    for (const it of itemsWithCalc) {
      await client.query(
        `INSERT INTO po_items (po_id, product_id, unit, quantity, unit_price, total_price, description, wht_rate, wht_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, it.product_id, it.unit || 'ชิ้น',
         it.quantity, it.unit_price, it.line_total,
         it.description || null,
         it.wht_rate, it.wht_amount]
      );
    }

    await client.query('COMMIT');
    res.json(updRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PUT /purchase-orders/:id error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ========== UNAPPROVE PO (revert approved → draft) ========== */
router.post('/:id/unapprove', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `UPDATE purchase_orders
       SET status = 'draft',
           approved_by = NULL,
           approved_at = NULL,
           updated_at = NOW()
       WHERE id = $1 AND status = 'approved'
       RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'ยกเลิกอนุมัติได้เฉพาะ PO ที่สถานะ "อนุมัติแล้ว" เท่านั้น (PO ที่รับสินค้าแล้วไม่สามารถยกเลิกได้)' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('POST /purchase-orders/:id/unapprove error:', err);
    res.status(500).json({ error: err.message });
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

/* ========== HELPER: createWHTForPO ==========
   สร้างใบหัก ณ ที่จ่ายจาก PO โดยใช้ po.wht_amount ที่มีอยู่ (per-item)
   ใช้ใน:
   - POST /:id/withholding (manual call)
   - PUT /:id/payment (auto-create เมื่อจ่ายเงินแล้วและมี WHT)
   ต้องเรียกอยู่ในส่วนของ transaction (BEGIN แล้ว) — function นี้ไม่ commit เอง
*/
async function createWHTForPO(client, poId, userId, opts = {}) {
  // ดึง PO + supplier
  const poRes = await client.query(
    `SELECT po.*, s.name AS supplier_name, s.tax_id AS supplier_tax_id,
            s.address AS supplier_address
     FROM purchase_orders po
     LEFT JOIN suppliers s ON s.id = po.supplier_id
     WHERE po.id = $1`, [poId]
  );
  if (poRes.rows.length === 0) {
    throw new Error('PO not found');
  }
  const po = poRes.rows[0];

  if (po.withholding_id) {
    throw new Error('PO นี้สร้างใบหัก ณ ที่จ่ายไปแล้ว');
  }

  // ใช้ wht_amount ที่อยู่ใน purchase_orders แล้ว (sum จาก po_items per-item)
  const tax = Number(po.wht_amount || 0);
  if (tax <= 0) {
    throw new Error('PO ไม่มียอดหัก ณ ที่จ่าย ไม่ต้องสร้างใบหัก ณ ที่จ่าย');
  }
  // income = total_amount (ก่อน VAT) — ใช้เป็น base ของใบ 50 ทวิ
  const income = Number(po.total_amount);
  // rate effective = tax / income * 100  (สำหรับเก็บใน purchase_orders.wht_rate เพื่ออ้างอิง)
  const effectiveRate = income > 0 ? +(tax / income * 100).toFixed(2) : 0;

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

  const issueDate = opts.issue_date || new Date();
  const pndForm = opts.pnd_form || 'ภ.ง.ด.3';
  const incomeType = opts.income_type || 'ม.3 เตรส';
  const incomeDesc = opts.income_desc || po.job_name || `ค่าจาก PO ${po.po_number}`;
  const withholdMethod = opts.withhold_method || 1;

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
      issueDate,
      'บริษัท ไอเดีย เฮ้าส์ เซ็นเตอร์ จำกัด (สำนักงานใหญ่)',
      '0105556022070',
      'เลขที่ 80 อาคาร เค.เอ.เอ็น.เพลส ห้องเลขที่ 104 ชั้น 1 ซ.นราธิวาสราชนครินทร์ 8 แขวงทุ่งวัดดอน เขตสาทร กรุงเทพฯ 10120',
      po.supplier_name,
      po.supplier_tax_id || '',
      po.supplier_address || '',
      pndForm, incomeType, incomeDesc,
      income, tax,
      withholdMethod,
      numToThaiWords(tax),
      userId
    ]
  );
  const wht = whtRes.rows[0];

  // insert item (1 row — รวมทั้ง PO เป็นรายการเดียว)
  await client.query(
    `INSERT INTO withholding_tax_items
       (wht_id, pay_date, description, income_amount, tax_amount, pnd_form, income_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [wht.id, issueDate, incomeDesc, income, tax, pndForm, incomeType]
  );

  // link กลับไปที่ PO (เก็บ effectiveRate ไว้อ้างอิง — ไม่กระทบ per-item ใน po_items)
  await client.query(
    `UPDATE purchase_orders
     SET withholding_id = $1,
         wht_rate = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [wht.id, effectiveRate, poId]
  );

  return wht;
}

/* ========== UPDATE PAYMENT INFO ========== */
router.put('/:id/payment', authenticate, async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const {
      payment_status, payment_date, payment_method,
      payment_reference, payment_amount, payment_notes,
      payment_bank_account_id
    } = req.body;

    // Validation: ถ้าเป็น transfer ต้องเลือกบัญชี
    if (payment_status === 'paid' && payment_method === 'transfer'
        && !payment_bank_account_id) {
      return res.status(400).json({ error: 'กรุณาเลือกบัญชีธนาคารบริษัทที่จ่ายเงินออก' });
    }

    await client.query('BEGIN');

    // update payment fields
    const updRes = await client.query(
      `UPDATE purchase_orders SET
         payment_status = COALESCE($1, payment_status),
         payment_date = $2,
         payment_method = $3,
         payment_reference = $4,
         payment_amount = $5,
         payment_notes = $6,
         payment_bank_account_id = $7,
         updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [payment_status || null, payment_date || null,
       payment_method || null, payment_reference || null,
       payment_amount !== undefined && payment_amount !== '' ? Number(payment_amount) : null,
       payment_notes || null,
       payment_bank_account_id ? Number(payment_bank_account_id) : null,
       id]
    );
    if (updRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'PO not found' });
    }

    const po = updRes.rows[0];

    // Auto-create WHT ถ้าจ่ายเงินแล้ว + มี wht_amount + ยังไม่มีใบ WHT
    let whtCreated = null;
    if (po.payment_status === 'paid'
        && Number(po.wht_amount) > 0
        && !po.withholding_id) {
      try {
        whtCreated = await createWHTForPO(client, id, req.user.id, {
          issue_date: payment_date || new Date()
        });
      } catch (e) {
        // ถ้าสร้าง WHT ล้มเหลว → rollback ทั้งหมด (ไม่ให้จ่ายค้างไว้โดยที่ไม่มีใบ WHT)
        await client.query('ROLLBACK');
        console.error('Auto-create WHT failed:', e.message);
        return res.status(500).json({ error: 'จ่ายเงินไม่สำเร็จ: ' + e.message });
      }
    }

    await client.query('COMMIT');

    // ดึงข้อมูล PO ล่าสุด (รวม withholding_doc_no + bank info) ส่งกลับ
    const finalRes = await query(
      `SELECT po.*,
              wht.doc_no AS withholding_doc_no,
              cba.bank_name AS payment_bank_name,
              cba.branch AS payment_bank_branch,
              cba.account_number AS payment_account_number,
              cba.account_name AS payment_account_name
       FROM purchase_orders po
       LEFT JOIN withholding_tax wht ON wht.id = po.withholding_id
       LEFT JOIN company_bank_accounts cba ON cba.id = po.payment_bank_account_id
       WHERE po.id = $1`, [id]
    );
    res.json({
      ...finalRes.rows[0],
      _wht_created: whtCreated ? { id: whtCreated.id, doc_no: whtCreated.doc_no } : null
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PUT /purchase-orders/:id/payment error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ========== CANCEL PAYMENT (revert payment_status → unpaid) ========== */
router.post('/:id/payment/cancel', authenticate, async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    await client.query('BEGIN');

    // ดึง PO ปัจจุบัน
    const poRes = await client.query(
      `SELECT * FROM purchase_orders WHERE id = $1 FOR UPDATE`, [id]
    );
    if (poRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'PO not found' });
    }
    const po = poRes.rows[0];

    // ยกเลิกใบ WHT ที่ link กับ PO นี้ (ถ้ามี)
    // — ไม่ลบทิ้ง เก็บประวัติไว้แต่เปลี่ยน status เป็น cancelled และ unlink จาก PO
    if (po.withholding_id) {
      await client.query(
        `UPDATE withholding_tax
         SET status = 'cancelled', updated_at = NOW()
         WHERE id = $1`,
        [po.withholding_id]
      );
    }

    // ลบ slip ที่เคย upload ทิ้ง (Option B)
    const slipsRes = await client.query(
      `SELECT id, file_path FROM po_documents WHERE po_id = $1 AND doc_type = 'slip'`,
      [id]
    );
    const slipsDeleted = slipsRes.rows.length;
    for (const slip of slipsRes.rows) {
      const fp = path.join(uploadDir, String(id), slip.file_path);
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp); }
      catch (e) { console.warn('delete slip file failed:', e.message); }
    }
    if (slipsDeleted > 0) {
      await client.query(
        `DELETE FROM po_documents WHERE po_id = $1 AND doc_type = 'slip'`,
        [id]
      );
    }

    // clear payment fields + unlink WHT + unlink bank
    await client.query(
      `UPDATE purchase_orders SET
         payment_status = 'unpaid',
         payment_date = NULL,
         payment_method = NULL,
         payment_reference = NULL,
         payment_amount = NULL,
         payment_notes = NULL,
         payment_bank_account_id = NULL,
         withholding_id = NULL,
         updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');
    res.json({
      success: true,
      wht_cancelled: !!po.withholding_id,
      slips_deleted: slipsDeleted
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /purchase-orders/:id/payment/cancel error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ========== CREATE WITHHOLDING TAX FROM PO (manual) ==========
   ใช้กรณีที่ผู้ใช้กดสร้างใบหัก ณ ที่จ่ายเองโดยไม่ผ่าน flow จ่ายเงิน
   (โดยปกติจะถูกเรียกอัตโนมัติจาก PUT /:id/payment ตอนจ่ายเงิน)
*/
router.post('/:id/withholding', authenticate, async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    await client.query('BEGIN');
    const wht = await createWHTForPO(client, id, req.user.id, req.body);
    await client.query('COMMIT');
    res.status(201).json({ ...wht, po_id: parseInt(id) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /purchase-orders/:id/withholding error:', err);
    const msg = err.message || 'error';
    const code = msg.includes('not found') ? 404
              : msg.includes('สร้างใบหัก') ? 400
              : msg.includes('ไม่มียอด') ? 400
              : 500;
    res.status(code).json({ error: msg });
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
                     (it.description ? `\n${it.description}` : ''),
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        total: Number(it.total_price),
        wht_rate: Number(it.wht_rate || 0),
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
    const docType = req.query.type || null; // 'general' | 'slip' | null (all)
    const params = [id];
    let typeFilter = '';
    if (docType) {
      typeFilter = ' AND d.doc_type = $2';
      params.push(docType);
    }
    const result = await query(
      `SELECT d.*, u.username AS uploaded_by_name
       FROM po_documents d
       LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE d.po_id = $1${typeFilter}
       ORDER BY d.uploaded_at DESC`,
      params
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
         (po_id, file_name, file_path, mime_type, file_size, notes, uploaded_by, doc_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, req.file.originalname, req.file.filename,
       req.file.mimetype, req.file.size,
       req.body.notes || null, req.user.id,
       (req.body.doc_type === 'slip') ? 'slip' : 'general']
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
