// backend/src/routes/product-categories.js
const express = require('express');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

/* ========== HELPER ==========
   Build tree structure: หมวดหลัก + nested children
================================================== */
function buildTree(rows) {
  const byId = new Map();
  const roots = [];
  rows.forEach(r => {
    byId.set(r.id, { ...r, children: [] });
  });
  rows.forEach(r => {
    const node = byId.get(r.id);
    if (r.parent_id) {
      const parent = byId.get(r.parent_id);
      if (parent) parent.children.push(node);
      else roots.push(node); // orphan — เผื่อ parent หาย
    } else {
      roots.push(node);
    }
  });
  return roots;
}

/* ========== LIST ==========
   query string:
     ?flat=1   → flat list (ตัวเดิม สำหรับ backward compat)
     default   → tree structure (หมวดหลัก + children)
================================================== */
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, code, description, parent_id, is_active,
              (SELECT COUNT(*) FROM products WHERE category_id = c.id) AS product_count
       FROM product_categories c
       WHERE is_active = true OR is_active IS NULL
       ORDER BY parent_id NULLS FIRST, name ASC`
    );
    const rows = result.rows;

    if (req.query.flat === '1') {
      return res.json(rows);
    }

    res.json(buildTree(rows));
  } catch (err) {
    console.error('GET /product-categories error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== CREATE ==========
   body: { name, code?, description?, parent_id? }
   - ถ้า parent_id null → หมวดหลัก (code prefix CAT-)
   - ถ้า parent_id เป็นเลข → หมวดย่อย (code prefix SUB-)
================================================== */
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, code, description, parent_id } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อหมวดหมู่' });
    }

    // validate parent_id ถ้ามี
    let parentId = null;
    if (parent_id !== null && parent_id !== undefined && parent_id !== '') {
      parentId = parseInt(parent_id);
      if (isNaN(parentId)) {
        return res.status(400).json({ error: 'parent_id ไม่ถูกต้อง' });
      }
      // เช็คว่า parent มีอยู่จริงและไม่ใช่หมวดย่อยอยู่แล้ว
      const parentCheck = await query(
        `SELECT id, parent_id FROM product_categories WHERE id = $1`,
        [parentId]
      );
      if (parentCheck.rows.length === 0) {
        return res.status(400).json({ error: 'หมวดหลักที่เลือกไม่มีอยู่ในระบบ' });
      }
      if (parentCheck.rows[0].parent_id !== null) {
        return res.status(400).json({ error: 'รองรับหมวดย่อยได้สูงสุด 2 ระดับ' });
      }
    }

    // auto-generate code ถ้าไม่ส่งมา
    let finalCode = code ? String(code).trim() : null;
    if (!finalCode) {
      const prefix = parentId ? 'SUB' : 'CAT';
      const last = await query(
        `SELECT code FROM product_categories
         WHERE code LIKE $1 ORDER BY code DESC LIMIT 1`,
        [`${prefix}-%`]
      );
      let nextNum = 1;
      if (last.rows.length > 0 && last.rows[0].code) {
        const m = last.rows[0].code.match(new RegExp(`${prefix}-(\\d+)`));
        if (m) nextNum = parseInt(m[1]) + 1;
      }
      finalCode = `${prefix}-${String(nextNum).padStart(3, '0')}`;
    }

    // check duplicate (ชื่อต้องไม่ซ้ำในขอบเขตเดียวกัน — ภายใต้ parent เดียวกัน)
    const dup = await query(
      `SELECT id FROM product_categories
       WHERE (name = $1 AND COALESCE(parent_id, 0) = COALESCE($2, 0))
          OR code = $3`,
      [String(name).trim(), parentId, finalCode]
    );
    if (dup.rows.length > 0) {
      return res.status(400).json({ error: 'ชื่อหรือรหัสหมวดหมู่ซ้ำ' });
    }

    const result = await query(
      `INSERT INTO product_categories (name, code, description, parent_id, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [String(name).trim(), finalCode, description || null, parentId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /product-categories error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== UPDATE ==========
   PUT /:id  — แก้ name, code, description, parent_id
   - ห้ามเปลี่ยน parent_id ถ้าตัวเองมี children (จะกลายเป็น 3 ระดับ)
   - ห้าม self-reference (handle โดย trigger ใน DB อยู่แล้ว)
================================================== */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, parent_id } = req.body;

    // ถ้าจะเปลี่ยน parent_id → เช็คว่าตัวเองมี children ไหม
    if (parent_id !== undefined) {
      const childrenCheck = await query(
        `SELECT COUNT(*) FROM product_categories WHERE parent_id = $1`, [id]
      );
      const newParent = (parent_id === null || parent_id === '') ? null : parseInt(parent_id);
      if (parseInt(childrenCheck.rows[0].count) > 0 && newParent !== null) {
        return res.status(400).json({
          error: 'หมวดนี้มีหมวดย่อยอยู่ — ย้ายให้เป็นหมวดย่อยไม่ได้'
        });
      }
      // เช็คว่า parent ใหม่ไม่ใช่หมวดย่อย
      if (newParent !== null) {
        if (newParent === parseInt(id)) {
          return res.status(400).json({ error: 'หมวดหมู่ไม่สามารถเป็น parent ของตัวเองได้' });
        }
        const parentCheck = await query(
          `SELECT parent_id FROM product_categories WHERE id = $1`, [newParent]
        );
        if (parentCheck.rows.length === 0) {
          return res.status(400).json({ error: 'หมวดหลักที่เลือกไม่มีอยู่' });
        }
        if (parentCheck.rows[0].parent_id !== null) {
          return res.status(400).json({ error: 'รองรับหมวดย่อยได้สูงสุด 2 ระดับ' });
        }
      }

      const result = await query(
        `UPDATE product_categories SET
           name = COALESCE($1, name),
           code = COALESCE($2, code),
           description = $3,
           parent_id = $4,
           updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [name, code, description || null, newParent, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
      return res.json(result.rows[0]);
    }

    // ไม่เปลี่ยน parent_id
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

/* ========== DELETE ==========
   - ห้ามลบถ้ามีสินค้าใช้
   - ห้ามลบถ้ามีหมวดย่อย (ต้องลบหมวดย่อยก่อน หรือ user ต้องเข้าใจ)
================================================== */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // เช็คว่ามีสินค้าใช้หมวดนี้หรือไม่ (รวมหมวดย่อยด้วย)
    const productCheck = await query(
      `SELECT COUNT(*) FROM products
       WHERE category_id = $1
          OR category_id IN (SELECT id FROM product_categories WHERE parent_id = $1)`,
      [id]
    );
    if (parseInt(productCheck.rows[0].count) > 0) {
      return res.status(400).json({
        error: `ลบไม่ได้: มีสินค้า ${productCheck.rows[0].count} รายการใช้หมวดนี้ (หรือหมวดย่อย) อยู่`
      });
    }

    // เช็คว่ามีหมวดย่อยหรือไม่
    const childrenCheck = await query(
      `SELECT COUNT(*) FROM product_categories WHERE parent_id = $1`, [id]
    );
    if (parseInt(childrenCheck.rows[0].count) > 0) {
      return res.status(400).json({
        error: `ลบไม่ได้: มีหมวดย่อย ${childrenCheck.rows[0].count} รายการ — กรุณาลบหมวดย่อยก่อน`
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
