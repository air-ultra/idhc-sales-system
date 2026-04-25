const express = require('express');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

async function genSupplierCode() {
  const result = await query("SELECT nextval('supplier_code_seq') AS seq");
  return 'SUP-' + String(result.rows[0].seq).padStart(4, '0');
}

// LIST
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, active } = req.query;
    let sql = 'SELECT * FROM suppliers WHERE 1=1';
    const params = [];
    if (active !== undefined) { params.push(active === 'true'); sql += ` AND is_active = $${params.length}`; }
    if (search) { params.push(`%${search}%`); sql += ` AND (name ILIKE $${params.length} OR code ILIKE $${params.length})`; }
    sql += ' ORDER BY code';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET BY ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'ไม่พบผู้จำหน่าย' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// CREATE
router.post('/', authenticate, async (req, res) => {
  try {
    const d = req.body;
    const code = d.code || await genSupplierCode();
    const result = await query(`
      INSERT INTO suppliers (code, name, contact_person, phone, email, address, tax_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [code, d.name, d.contact_person || '', d.phone || '', d.email || '', d.address || '', d.tax_id || '']);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// UPDATE handler (shared by PATCH and PUT)
const updateSupplier = async (req, res) => {
  try {
    const d = req.body;
    await query(`
      UPDATE suppliers SET
        name = COALESCE($1, name), contact_person = COALESCE($2, contact_person),
        phone = COALESCE($3, phone), email = COALESCE($4, email),
        address = COALESCE($5, address), tax_id = COALESCE($6, tax_id),
        is_active = COALESCE($7, is_active), updated_at = NOW()
      WHERE id = $8
    `, [d.name, d.contact_person, d.phone, d.email, d.address, d.tax_id, d.is_active, req.params.id]);
    const updated = await query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);
    res.json(updated.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

router.patch('/:id', authenticate, updateSupplier);
router.put('/:id', authenticate, updateSupplier);

// DELETE (soft)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await query('UPDATE suppliers SET is_active = false, updated_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ message: 'ลบสำเร็จ' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
