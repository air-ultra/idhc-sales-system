// backend/src/routes/departments.js
// Department CRUD — สำหรับ SettingsPage tab "🏢 แผนก"

const express = require('express');
const router = express.Router();
const { query, getClient } = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');

/**
 * GET /api/departments
 * List ทั้งหมด (รวม inactive) + count staff per department
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT d.*,
              COALESCE(s.staff_count, 0) AS staff_count
         FROM departments d
         LEFT JOIN (
           SELECT department_id, COUNT(*) AS staff_count
             FROM staff
            WHERE department_id IS NOT NULL
            GROUP BY department_id
         ) s ON s.department_id = d.id
        ORDER BY d.is_active DESC, d.name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[departments GET]', err);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

/**
 * POST /api/departments
 * Create department ใหม่
 * Body: { name, code, is_active? }
 */
router.post('/', authenticate, requirePermission('manage_users'), async (req, res) => {
  try {
    const { name, code, is_active = true } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อแผนก' });
    }
    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'กรุณากรอกรหัสแผนก' });
    }

    // Check code unique
    const dup = await query('SELECT id FROM departments WHERE code = $1', [code.trim()]);
    if (dup.rows.length > 0) {
      return res.status(400).json({ error: `รหัสแผนก "${code}" ถูกใช้แล้ว` });
    }

    const result = await query(
      `INSERT INTO departments (name, code, is_active)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name.trim(), code.trim(), is_active]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[departments POST]', err);
    res.status(500).json({ error: err.message || 'Failed to create department' });
  }
});

/**
 * PUT /api/departments/:id
 * Update department
 * Body: { name?, code?, is_active? }
 */
router.put('/:id', authenticate, requirePermission('manage_users'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, is_active } = req.body;

    // Check exist
    const existing = await query('SELECT * FROM departments WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบแผนกนี้' });
    }

    // Validation
    if (name !== undefined && !name.trim()) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อแผนก' });
    }
    if (code !== undefined && !code.trim()) {
      return res.status(400).json({ error: 'กรุณากรอกรหัสแผนก' });
    }

    // Check code unique (ถ้าเปลี่ยน code)
    if (code !== undefined && code.trim() !== existing.rows[0].code) {
      const dup = await query('SELECT id FROM departments WHERE code = $1 AND id != $2', [code.trim(), id]);
      if (dup.rows.length > 0) {
        return res.status(400).json({ error: `รหัสแผนก "${code}" ถูกใช้แล้ว` });
      }
    }

    const result = await query(
      `UPDATE departments
          SET name = COALESCE($1, name),
              code = COALESCE($2, code),
              is_active = COALESCE($3, is_active),
              updated_at = NOW()
        WHERE id = $4
        RETURNING *`,
      [
        name !== undefined ? name.trim() : null,
        code !== undefined ? code.trim() : null,
        is_active !== undefined ? is_active : null,
        id,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[departments PUT]', err);
    res.status(500).json({ error: err.message || 'Failed to update department' });
  }
});

/**
 * DELETE /api/departments/:id
 * ลบ department
 *  - ถ้ามี staff ผูกอยู่ → soft delete (set is_active=false) + return { soft: true }
 *  - ถ้าไม่มี → ลบจริง
 */
router.delete('/:id', authenticate, requirePermission('manage_users'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check exist
    const existing = await query('SELECT * FROM departments WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบแผนกนี้' });
    }

    // Check FK: มี staff ผูกอยู่ไหม
    const staffCheck = await query(
      'SELECT COUNT(*)::int AS cnt FROM staff WHERE department_id = $1',
      [id]
    );
    const staffCount = staffCheck.rows[0].cnt;

    if (staffCount > 0) {
      // Soft delete
      await query('UPDATE departments SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);
      return res.json({
        soft: true,
        message: `แผนกนี้มีพนักงาน ${staffCount} คนผูกอยู่ — ปิดการใช้งานแทนการลบ`,
      });
    }

    // Hard delete
    await query('DELETE FROM departments WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[departments DELETE]', err);
    res.status(500).json({ error: err.message || 'Failed to delete department' });
  }
});

module.exports = router;
