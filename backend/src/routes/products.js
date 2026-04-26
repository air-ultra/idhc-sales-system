// backend/src/routes/products.js
const express = require('express');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

/* ========== LIST ==========
   avg_cost: สำหรับสินค้า stock ใช้ AVG(cost_price) ของ serial available
             สำหรับประเภทอื่นใช้ products.cost_price
================================================== */
router.get('/', authenticate, async (req, res) => {
  try {
    const { product_type, category_id, search } = req.query;
    const params = [];
    const conditions = [];

    if (product_type) {
      params.push(product_type);
      conditions.push(`p.product_type = $${params.length}`);
    }
    if (category_id) {
      params.push(category_id);
      conditions.push(`p.category_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(p.product_code ILIKE $${idx} OR p.name ILIKE $${idx} OR p.model ILIKE $${idx})`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
      `SELECT
         p.*,
         c.name AS category_name,
         CASE
           WHEN p.product_type = 'stock' THEN
             COALESCE((
               SELECT AVG(cost_price)
               FROM product_serials
               WHERE product_id = p.id AND status = 'available' AND cost_price > 0
             ), p.cost_price, 0)
           ELSE p.cost_price
         END AS avg_cost
       FROM products p
       LEFT JOIN product_categories c ON c.id = p.category_id
       ${whereClause}
       ORDER BY p.id DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /products error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== GET by id ========== */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT
         p.*,
         c.name AS category_name,
         CASE
           WHEN p.product_type = 'stock' THEN
             COALESCE((
               SELECT AVG(cost_price)
               FROM product_serials
               WHERE product_id = p.id AND status = 'available' AND cost_price > 0
             ), p.cost_price, 0)
           ELSE p.cost_price
         END AS avg_cost
       FROM products p
       LEFT JOIN product_categories c ON c.id = p.category_id
       WHERE p.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /products/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== GET serials (with cost_price + PO info) ========== */
router.get('/:id/serials', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT
         ps.*,
         po.po_number,
         po.received_at AS po_received_at,
         po.po_date AS po_order_date,
         s.name AS supplier_name
       FROM product_serials ps
       LEFT JOIN purchase_orders po ON po.id = ps.po_id
       LEFT JOIN suppliers s ON s.id = po.supplier_id
       WHERE ps.product_id = $1
       ORDER BY ps.created_at DESC, ps.id DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /products/:id/serials error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== ADD serial manually ========== */
router.post('/:id/serials', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { serial_no, mac_address, cost_price, notes } = req.body;
    if (!serial_no || !String(serial_no).trim()) {
      return res.status(400).json({ error: 'serial_no required' });
    }

    const dup = await query(
      `SELECT id FROM product_serials WHERE product_id = $1 AND serial_no = $2`,
      [id, String(serial_no).trim()]
    );
    if (dup.rows.length > 0) {
      return res.status(400).json({ error: `Serial "${serial_no}" มีอยู่แล้ว` });
    }

    const result = await query(
      `INSERT INTO product_serials (product_id, serial_no, mac_address, status, cost_price, notes)
       VALUES ($1, $2, $3, 'available', $4, $5)
       RETURNING *`,
      [id, String(serial_no).trim(), mac_address || null,
       Number(cost_price || 0), notes || null]
    );
    await query(
      `UPDATE products
       SET stock_qty = CASE WHEN stock_qty IS NULL OR stock_qty::text = 'NaN' THEN 0 ELSE stock_qty END + 1,
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /products/:id/serials error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== DELETE serial ========== */
router.delete('/:id/serials/:serialId', authenticate, async (req, res) => {
  try {
    const { id, serialId } = req.params;
    const result = await query(
      `DELETE FROM product_serials WHERE id = $1 AND product_id = $2 RETURNING *`,
      [serialId, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Serial not found' });
    await query(
      `UPDATE products
       SET stock_qty = GREATEST(CASE WHEN stock_qty IS NULL OR stock_qty::text = 'NaN' THEN 0 ELSE stock_qty END - 1, 0),
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /products/:id/serials/:serialId error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== HELPER: validate category ==========
   ห้ามผูกสินค้ากับหมวดที่มี subcategory (ต้องเลือก subcategory แทน)
================================================== */
async function validateCategoryIsLeaf(category_id) {
  if (!category_id) return null; // ไม่เลือก = ผ่าน
  const childrenCheck = await query(
    `SELECT COUNT(*) AS c FROM product_categories WHERE parent_id = $1`,
    [category_id]
  );
  if (parseInt(childrenCheck.rows[0].c) > 0) {
    return 'หมวดหมู่นี้มีหมวดย่อย — กรุณาเลือกหมวดย่อย';
  }
  return null;
}

/* ========== CREATE product ========== */
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      name, model, description, category_id, product_type,
      default_unit, cost_price, sell_price
    } = req.body;

    if (!name) return res.status(400).json({ error: 'name required' });

    const catErr = await validateCategoryIsLeaf(category_id);
    if (catErr) return res.status(400).json({ error: catErr });

    const last = await query(`SELECT product_code FROM products ORDER BY id DESC LIMIT 1`);
    let nextNum = 1;
    if (last.rows.length > 0 && last.rows[0].product_code) {
      const m = last.rows[0].product_code.match(/PRD-(\d+)/);
      if (m) nextNum = parseInt(m[1]) + 1;
    }
    const product_code = `PRD-${String(nextNum).padStart(4, '0')}`;

    const result = await query(
      `INSERT INTO products
         (product_code, name, model, description, category_id, product_type, default_unit,
          cost_price, sell_price, stock_qty, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, true)
       RETURNING *`,
      [product_code, name, model || null, description || null, category_id || null,
       product_type || 'stock', default_unit || 'ชิ้น',
       cost_price || 0, sell_price || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /products error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== UPDATE product ========== */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, model, description, category_id, product_type,
      default_unit, cost_price, sell_price
    } = req.body;

    const catErr = await validateCategoryIsLeaf(category_id);
    if (catErr) return res.status(400).json({ error: catErr });

    const result = await query(
      `UPDATE products SET
         name = COALESCE($1, name),
         model = $2,
         description = $3,
         category_id = $4,
         product_type = COALESCE($5, product_type),
         default_unit = COALESCE($6, default_unit),
         cost_price = COALESCE($7, cost_price),
         sell_price = COALESCE($8, sell_price),
         updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [name, model || null, description || null, category_id || null,
       product_type, default_unit, cost_price, sell_price, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /products/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== DELETE product ========== */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const serialCheck = await query(
      `SELECT COUNT(*) FROM product_serials WHERE product_id = $1`, [id]
    );
    if (parseInt(serialCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: 'ลบไม่ได้: มี Serial ในระบบอยู่' });
    }
    await query(`DELETE FROM products WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /products/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== adjust stock (non_stock) ========== */
router.post('/:id/adjust-stock', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { qty_change } = req.body;
    if (!qty_change || qty_change === 0) {
      return res.status(400).json({ error: 'qty_change required' });
    }
    const result = await query(
      `UPDATE products
       SET stock_qty = GREATEST(CASE WHEN stock_qty IS NULL OR stock_qty::text = 'NaN' THEN 0 ELSE stock_qty END + $1, 0),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [qty_change, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('POST /products/:id/adjust-stock error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
