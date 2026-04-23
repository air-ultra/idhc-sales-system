const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const router = express.Router();

// GET /api/users
router.get('/', authenticate, requirePermission('user', 'view'), async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.username, u.email, u.is_active, u.last_login, u.created_at,
              r.name as role_name, r.code as role_code, u.role_id,
              s.employee_code, s.first_name_th, s.last_name_th, u.staff_id
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN staff s ON u.staff_id = s.id
       ORDER BY u.created_at DESC`
    );
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/roles
router.get('/roles', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM roles WHERE is_active = true ORDER BY name');
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// POST /api/users
router.post('/', authenticate, requirePermission('user', 'create'), async (req, res) => {
  try {
    const { username, email, password, staff_id, role_id } = req.body;
    if (!username || !password || !role_id) {
      return res.status(400).json({ error: 'Username, password and role are required' });
    }
    const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (username, email, password_hash, staff_id, role_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email`,
      [username, email, hash, staff_id || null, role_id]
    );
    res.status(201).json({ data: result.rows[0], message: 'User created successfully' });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/users/:id
router.put('/:id', authenticate, requirePermission('user', 'edit'), async (req, res) => {
  try {
    const { email, role_id, is_active, staff_id } = req.body;
    const result = await query(
      `UPDATE users SET email=$1, role_id=$2, is_active=$3, staff_id=$4, updated_at=NOW()
       WHERE id=$5 RETURNING id, username, email, is_active`,
      [email, role_id, is_active, staff_id || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ data: result.rows[0], message: 'User updated successfully' });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// PUT /api/users/:id/reset-password
router.put('/:id/reset-password', authenticate, requirePermission('user', 'edit'), async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, req.params.id]);
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// GET /api/users/roles/:id/permissions
router.get('/roles/:id/permissions', authenticate, async (req, res) => {
  try {
    const allPerms = await query('SELECT * FROM permissions ORDER BY module, action');
    const rolePerms = await query('SELECT permission_id FROM role_permissions WHERE role_id = $1', [req.params.id]);
    const rolePermIds = rolePerms.rows.map(r => r.permission_id);
    const data = allPerms.rows.map(p => ({ ...p, granted: rolePermIds.includes(p.id) }));
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// PUT /api/users/roles/:id/permissions
router.put('/roles/:id/permissions', authenticate, requirePermission('role', 'edit'), async (req, res) => {
  try {
    const { permission_ids } = req.body;
    await query('DELETE FROM role_permissions WHERE role_id = $1', [req.params.id]);
    for (const pid of permission_ids) {
      await query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.id, pid]);
    }
    res.json({ message: 'บันทึกสิทธิ์สำเร็จ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save permissions' });
  }
});

module.exports = router;
