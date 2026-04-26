// backend/src/routes/companyBankAccounts.js
const express = require('express');
const { query, getClient } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

/* ========== GET ALL BANK ACCOUNTS ==========
   ?active=1 → only active accounts
*/
router.get('/', authenticate, async (req, res) => {
  try {
    const onlyActive = req.query.active === '1' || req.query.active === 'true';
    const result = await query(
      `SELECT * FROM company_bank_accounts
       ${onlyActive ? "WHERE is_active = TRUE" : ""}
       ORDER BY is_default DESC, display_order ASC, id ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /company-bank-accounts error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ========== GET ONE ========== */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM company_bank_accounts WHERE id = $1`, [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ========== CREATE ========== */
router.post('/', authenticate, async (req, res) => {
  const client = await getClient();
  try {
    const {
      bank_name, branch, account_number, account_name,
      is_active, is_default, display_order, notes
    } = req.body;

    if (!bank_name || !account_number || !account_name) {
      return res.status(400).json({ error: 'bank_name, account_number, account_name จำเป็น' });
    }

    await client.query('BEGIN');

    // ถ้าตั้งเป็น default → unset default ของอันอื่น
    if (is_default) {
      await client.query(`UPDATE company_bank_accounts SET is_default = FALSE WHERE is_default = TRUE`);
    }

    const result = await client.query(
      `INSERT INTO company_bank_accounts
         (bank_name, branch, account_number, account_name,
          is_active, is_default, display_order, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [bank_name.trim(), branch ? branch.trim() : null,
       account_number.trim(), account_name.trim(),
       is_active !== false, !!is_default,
       Number(display_order) || 0, notes || null]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /company-bank-accounts error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ========== UPDATE ========== */
const updateBank = async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const {
      bank_name, branch, account_number, account_name,
      is_active, is_default, display_order, notes
    } = req.body;

    if (!bank_name || !account_number || !account_name) {
      return res.status(400).json({ error: 'bank_name, account_number, account_name จำเป็น' });
    }

    await client.query('BEGIN');

    // ถ้าตั้งเป็น default → unset default ของอันอื่น
    if (is_default) {
      await client.query(
        `UPDATE company_bank_accounts SET is_default = FALSE WHERE is_default = TRUE AND id <> $1`,
        [id]
      );
    }

    const result = await client.query(
      `UPDATE company_bank_accounts SET
         bank_name = $1, branch = $2, account_number = $3, account_name = $4,
         is_active = $5, is_default = $6, display_order = $7, notes = $8,
         updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [bank_name.trim(), branch ? branch.trim() : null,
       account_number.trim(), account_name.trim(),
       is_active !== false, !!is_default,
       Number(display_order) || 0, notes || null, id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'not found' });
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PUT /company-bank-accounts/:id error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};
router.put('/:id', authenticate, updateBank);
router.patch('/:id', authenticate, updateBank);

/* ========== DELETE ==========
   ถ้ายังไม่เคยถูกใช้ใน PO → hard delete
   ถ้าเคยใช้แล้ว → soft delete (set is_active=false)
*/
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // เช็คว่ามี PO ใช้บัญชีนี้อยู่ไหม
    const used = await query(
      `SELECT COUNT(*)::int AS cnt FROM purchase_orders WHERE payment_bank_account_id = $1`,
      [id]
    );
    if (used.rows[0].cnt > 0) {
      // soft delete
      const result = await query(
        `UPDATE company_bank_accounts
         SET is_active = FALSE, is_default = FALSE, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
      return res.json({ success: true, soft: true, message: 'บัญชีถูกใช้ใน PO แล้ว — ปิดการใช้งานแทนการลบ' });
    }

    // hard delete
    const result = await query(
      `DELETE FROM company_bank_accounts WHERE id = $1 RETURNING id`, [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
    res.json({ success: true, soft: false });
  } catch (err) {
    console.error('DELETE /company-bank-accounts/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
