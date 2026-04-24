// backend/src/routes/product-categories.js
const express = require('express');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

/* ========== LIST ========== */
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, code, description, is_active,
              (SELECT COUNT(*) FROM products WHERE category_id = c.id) AS product_count
       FROM product_categories c
       WHERE is_active = true OR is_active IS NULL
       ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /product-categories error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== CREATE ========== */
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, code, description } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อหมวดหมู่' });
    }

    // auto-generate code ถ้าไม่ส่งมา
    let finalCode = code ? String(code).trim() : null;
    if (!finalCode) {
      const last = await query(
        `SELECT code FROM product_categories
         WHERE code LIKE 'CAT-%' ORDER BY code DESC LIMIT 1`
      );
      let nextNum = 1;
      if (last.rows.length > 0 && last.rows[0].code) {
        const m = last.rows[0].code.match(/CAT-(\d+)/);
        if (m) nextNum = parseInt(m[1]) + 1;
      }
      finalCode = `CAT-${String(nextNum).padStart(3, '0')}`;
    }

    // check duplicate
    const dup = await query(
      `SELECT id FROM product_categories WHERE name = $1 OR code = $2`,
      [String(name).trim(), finalCode]
    );
    if (dup.rows.length > 0) {
      return res.status(400).json({ error: 'ชื่อหรือรหัสหมวดหมู่ซ้ำ' });
    }

    const result = await query(
      `INSERT INTO product_categories (name, code, description, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING *`,
      [String(name).trim(), finalCode, description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /product-categories error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== UPDATE ========== */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description } = req.body;
    const result = await query(
      `UPDATE product_categories SET
         name = COALESCE($1, name),
         code = COALESCE($2, code),
         description = $3,
         updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [name, code, description || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /product-categories/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== DELETE ========== */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    // check ว่ามีสินค้าใช้หมวดนี้อยู่ไหม
    const productCheck = await query(
      `SELECT COUNT(*) FROM products WHERE category_id = $1`, [id]
    );
    if (parseInt(productCheck.rows[0].count) > 0) {
      return res.status(400).json({
        error: `ลบไม่ได้: มีสินค้า ${productCheck.rows[0].count} รายการใช้หมวดนี้อยู่`
      });
    }
    const result = await query(
      `DELETE FROM product_categories WHERE id = $1 RETURNING *`, [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /product-categories/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
