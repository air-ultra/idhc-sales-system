const express = require('express');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

async function genProductCode() {
  const result = await query("SELECT nextval('product_code_seq') AS seq");
  return 'PRD-' + String(result.rows[0].seq).padStart(4, '0');
}

// ═══ CATEGORIES ═══
router.get('/categories', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM product_categories WHERE is_active = true ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/categories', authenticate, async (req, res) => {
  try {
    const { name, code, description } = req.body;
    const result = await query(
      'INSERT INTO product_categories (name, code, description) VALUES ($1, $2, $3) RETURNING *',
      [name, code, description || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══ PRODUCTS ═══

// LIST
router.get('/', authenticate, async (req, res) => {
  try {
    const { category_id, search, active, product_type } = req.query;
    let sql = `SELECT p.*, c.name AS category_name
               FROM products p
               LEFT JOIN product_categories c ON p.category_id = c.id
               WHERE 1=1`;
    const params = [];
    if (category_id) { params.push(category_id); sql += ` AND p.category_id = $${params.length}`; }
    if (active !== undefined) { params.push(active === 'true'); sql += ` AND p.is_active = $${params.length}`; }
    if (product_type) { params.push(product_type); sql += ` AND p.product_type = $${params.length}`; }
    if (search) { params.push(`%${search}%`); sql += ` AND (p.name ILIKE $${params.length} OR p.product_code ILIKE $${params.length} OR p.model ILIKE $${params.length})`; }
    sql += ' ORDER BY p.product_code';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET BY ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, c.name AS category_name
       FROM products p LEFT JOIN product_categories c ON p.category_id = c.id
       WHERE p.id = $1`, [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'ไม่พบสินค้า' });

    // Get serials (for stock type)
    const serials = await query('SELECT * FROM product_serials WHERE product_id = $1 ORDER BY id', [req.params.id]);

    // Get recent movements
    const movements = await query(
      `SELECT sm.*, u.username AS created_by_name
       FROM stock_movements sm
       LEFT JOIN users u ON sm.created_by = u.id
       WHERE sm.product_id = $1
       ORDER BY sm.created_at DESC LIMIT 20`, [req.params.id]);

    res.json({ ...result.rows[0], serials: serials.rows, movements: movements.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// CREATE
router.post('/', authenticate, async (req, res) => {
  try {
    const d = req.body;
    const product_code = d.product_code || await genProductCode();
    const result = await query(`
      INSERT INTO products (product_code, name, model, category_id, product_type, default_unit, cost_price, sell_price, stock_qty, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
    `, [product_code, d.name, d.model || '', d.category_id || null, d.product_type || 'stock',
        d.default_unit || 'ชิ้น', d.cost_price || 0, d.sell_price || 0, d.stock_qty || 0, d.description || '']);

    // Insert initial stock movement if stock_qty > 0 and type is stock
    if (parseFloat(d.stock_qty) > 0 && d.product_type === 'stock') {
      await query(`
        INSERT INTO stock_movements (product_id, movement_type, quantity, before_qty, after_qty, reference_type, notes, created_by)
        VALUES ($1, 'in', $2, 0, $2, 'initial', 'สต็อกเริ่มต้น', $3)
      `, [result.rows[0].id, d.stock_qty, req.user.id]);
    }

    // Insert serials if provided
    if (d.serials && d.serials.length) {
      for (const s of d.serials) {
        await query('INSERT INTO product_serials (product_id, serial_no, mac_address, notes) VALUES ($1, $2, $3, $4)',
          [result.rows[0].id, s.serial_no || '', s.mac_address || '', s.notes || '']);
      }
    }

    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// UPDATE
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const d = req.body;
    await query(`
      UPDATE products SET
        name = COALESCE($1, name), model = COALESCE($2, model),
        category_id = COALESCE($3, category_id), product_type = COALESCE($4, product_type),
        default_unit = COALESCE($5, default_unit),
        cost_price = COALESCE($6, cost_price), sell_price = COALESCE($7, sell_price),
        description = COALESCE($8, description), is_active = COALESCE($9, is_active),
        updated_at = NOW()
      WHERE id = $10
    `, [d.name, d.model, d.category_id, d.product_type, d.default_unit, d.cost_price, d.sell_price, d.description, d.is_active, req.params.id]);

    const updated = await query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    res.json(updated.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADJUST STOCK
router.post('/:id/adjust-stock', authenticate, async (req, res) => {
  try {
    const { type, quantity, notes } = req.body;
    if (!type || !quantity) return res.status(400).json({ error: 'ระบุประเภทและจำนวน' });

    const product = await query('SELECT stock_qty, product_type FROM products WHERE id = $1', [req.params.id]);
    if (!product.rows.length) return res.status(404).json({ error: 'ไม่พบสินค้า' });
    if (product.rows[0].product_type !== 'stock') return res.status(400).json({ error: 'ปรับ stock ได้เฉพาะสินค้านับสต็อก' });

    const before = parseFloat(product.rows[0].stock_qty);
    const qty = parseFloat(quantity);
    const after = type === 'in' ? before + qty : before - qty;

    if (after < 0) return res.status(400).json({ error: 'สต็อกไม่เพียงพอ' });

    await query('UPDATE products SET stock_qty = $1, updated_at = NOW() WHERE id = $2', [after, req.params.id]);

    await query(`
      INSERT INTO stock_movements (product_id, movement_type, quantity, before_qty, after_qty, reference_type, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, 'manual', $6, $7)
    `, [req.params.id, type, qty, before, after, notes || '', req.user.id]);

    res.json({ before, after, movement_type: type, quantity: qty });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══ SERIALS ═══

// Add serial
router.post('/:id/serials', authenticate, async (req, res) => {
  try {
    const { serial_no, mac_address, notes } = req.body;
    const result = await query(
      'INSERT INTO product_serials (product_id, serial_no, mac_address, notes) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.id, serial_no || '', mac_address || '', notes || '']);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete serial
router.delete('/:id/serials/:serialId', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM product_serials WHERE id = $1 AND product_id = $2', [req.params.serialId, req.params.id]);
    res.json({ message: 'ลบสำเร็จ' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE product (soft)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await query('UPDATE products SET is_active = false, updated_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ message: 'ลบสำเร็จ' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
