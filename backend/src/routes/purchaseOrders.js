// backend/src/routes/purchase-orders.js
const express = require('express');
const { query, getClient } = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const router = express.Router();

/* ========== GET all POs ========== */
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        po.*,
        s.name AS supplier_name,
        s.code AS supplier_code,
        COALESCE((SELECT COUNT(*) FROM po_items WHERE po_id = po.id), 0) AS item_count
      FROM purchase_orders po
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      ORDER BY po.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /purchase-orders error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== GET PO by id (with items) ========== */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const po = await query(
      `SELECT po.*,
              s.name AS supplier_name, s.code AS supplier_code,
              s.tax_id AS supplier_tax_id, s.address AS supplier_address,
              s.phone AS supplier_phone
       FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id
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
    const { supplier_id, po_date, notes, vat_rate, items } = req.body;

    if (!supplier_id) return res.status(400).json({ error: 'supplier_id is required' });
    if (!items || items.length === 0) return res.status(400).json({ error: 'items are required' });

    await client.query('BEGIN');

    // gen po_number: PO{YYYY}{MM}{NNNN} — running reset ทุกเดือน
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

    // totals
    let total_amount = 0;
    items.forEach(it => {
      total_amount += Number(it.quantity || 0) * Number(it.unit_price || 0);
    });
    const vat_amount = total_amount * (Number(vat_rate || 0) / 100);
    const grand_total = total_amount + vat_amount;

    const poRes = await client.query(
      `INSERT INTO purchase_orders
         (po_number, supplier_id, po_date, notes, vat_rate,
          total_amount, vat_amount, grand_total, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9)
       RETURNING *`,
      [po_number, supplier_id, po_date || new Date(), notes || null,
       vat_rate || 0, total_amount, vat_amount, grand_total, req.user.id]
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
  try {
    const { id } = req.params;
    const result = await query(
      `UPDATE purchase_orders
       SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND status = 'draft'
       RETURNING *`,
      [req.user.id, id]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'PO ไม่พบ หรือสถานะไม่ใช่ draft' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('POST /purchase-orders/:id/approve error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== RECEIVE PO (with serials) ========== */
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
               (product_id, serial_no, mac_address, status, po_id, notes, created_at)
             VALUES ($1, $2, $3, 'available', $4, $5, NOW())`,
            [
              poItem.product_id,
              String(s.serial_no).trim(),
              s.mac_address ? String(s.mac_address).trim() : null,
              id,
              s.notes || null
            ]
          );
        }

        await client.query(
          `UPDATE products
           SET stock_qty = CASE WHEN stock_qty IS NULL OR stock_qty::text = 'NaN' THEN 0 ELSE stock_qty END + $1, updated_at = NOW()
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
           SET stock_qty = CASE WHEN stock_qty IS NULL OR stock_qty::text = 'NaN' THEN 0 ELSE stock_qty END + $1, updated_at = NOW()
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
        // service
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
      return res.status(400).json({ error: 'ยกเลิกไม่ได้ (อาจรับสินค้าแล้วหรือยกเลิกไปแล้ว)' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('POST /purchase-orders/:id/cancel error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== DELETE PO (เฉพาะ draft) ========== */
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

module.exports = router;
