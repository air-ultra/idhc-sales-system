const express = require('express');
const { query } = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();

// GET /api/staff - list all staff
router.get('/', authenticate, requirePermission('staff', 'view'), async (req, res) => {
  try {
    const { search, department_id, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = [];
    let params = [];
    let idx = 1;

    if (search) {
      where.push(`(s.first_name_th ILIKE $${idx} OR s.last_name_th ILIKE $${idx} OR s.first_name_en ILIKE $${idx} OR s.last_name_en ILIKE $${idx} OR s.employee_code ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (department_id) {
      where.push(`s.department_id = $${idx}`);
      params.push(department_id);
      idx++;
    }
    if (status) {
      where.push(`s.status = $${idx}`);
      params.push(status);
      idx++;
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM staff s ${whereClause}`,
      params
    );

    const result = await query(
      `SELECT s.*, d.name as department_name, d.code as department_code
       FROM staff s
       LEFT JOIN departments d ON s.department_id = d.id
       ${whereClause}
       ORDER BY s.employee_code ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    res.json({
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countResult.rows[0].count / limit),
      },
    });
  } catch (err) {
    console.error('List staff error:', err);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// GET /api/staff/next-code - get next employee code
router.get('/next-code', authenticate, async (req, res) => {
  try {
    const lastCode = await query(
      `SELECT employee_code FROM staff 
       WHERE employee_code ~ '^EMP-[0-9]+$'
       ORDER BY employee_code DESC LIMIT 1`
    );
    let nextNum = 1;
    if (lastCode.rows.length > 0) {
      const lastNum = parseInt(lastCode.rows[0].employee_code.replace('EMP-', ''), 10);
      nextNum = lastNum + 1;
    }
    const nextCode = 'EMP-' + String(nextNum).padStart(3, '0');
    res.json({ data: nextCode });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate code' });
  }
});

// GET /api/staff/departments/list
router.get('/departments/list', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM departments WHERE is_active = true ORDER BY name');
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// GET /api/staff/:id
router.get('/:id', authenticate, requirePermission('staff', 'view'), async (req, res) => {
  try {
    const result = await query(
      `SELECT s.*, d.name as department_name, d.code as department_code
       FROM staff s
       LEFT JOIN departments d ON s.department_id = d.id
       WHERE s.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Staff not found' });
    }
    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Get staff error:', err);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// POST /api/staff
router.post('/', authenticate, requirePermission('staff', 'create'), async (req, res) => {
  try {
    const {
      title_th, first_name_th, last_name_th, nickname_th,
      first_name_en, last_name_en, nickname_en, id_card_number, passport_number,
      date_of_birth, department_id, position, hire_date, status
    } = req.body;

    if (!first_name_th || !last_name_th) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }

    // Auto generate employee_code
    const lastCode = await query(
      `SELECT employee_code FROM staff 
       WHERE employee_code ~ '^EMP-[0-9]+$'
       ORDER BY employee_code DESC LIMIT 1`
    );
    let nextNum = 1;
    if (lastCode.rows.length > 0) {
      const lastNum = parseInt(lastCode.rows[0].employee_code.replace('EMP-', ''), 10);
      nextNum = lastNum + 1;
    }
    const employee_code = 'EMP-' + String(nextNum).padStart(3, '0');

    const result = await query(
      `INSERT INTO staff (employee_code, title_th, first_name_th, last_name_th, nickname_th,
        first_name_en, last_name_en, nickname_en, id_card_number, passport_number,
        date_of_birth, department_id, position, hire_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [employee_code, title_th, first_name_th, last_name_th, nickname_th,
       first_name_en, last_name_en, nickname_en, id_card_number, passport_number,
       date_of_birth, department_id || null, position, hire_date, status || 'active']
    );

    // Auto create staff_employment
    const staffId = result.rows[0].id;
    let deptName = '';
    if (department_id) {
      const dept = await query('SELECT name FROM departments WHERE id = $1', [department_id]);
      if (dept.rows.length > 0) deptName = dept.rows[0].name;
    }
    await query(
      `INSERT INTO staff_employment (staff_id, hire_date, department, position) VALUES ($1, $2, $3, $4) ON CONFLICT (staff_id) DO NOTHING`,
      [staffId, hire_date || null, deptName, position || null]
    );

    res.status(201).json({ data: result.rows[0], message: 'Staff created successfully' });
  } catch (err) {
    console.error('Create staff error:', err);
    res.status(500).json({ error: 'Failed to create staff' });
  }
});

// Helper: log history
async function logHistory(staffId, changeType, field, oldVal, newVal, userId) {
  if (String(oldVal || '') === String(newVal || '')) return;
  await query(
    `INSERT INTO staff_history (staff_id, change_type, field_changed, old_value, new_value, changed_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [staffId, changeType, field, String(oldVal || ''), String(newVal || ''), userId]
  );
}

// PUT /api/staff/:id
router.put('/:id', authenticate, requirePermission('staff', 'edit'), async (req, res) => {
  try {
    const {
      title_th, first_name_th, last_name_th, nickname_th,
      first_name_en, last_name_en, nickname_en, id_card_number, passport_number,
      date_of_birth, department_id, position, hire_date, status
    } = req.body;

    // Get old data for history
    const old = await query(
      `SELECT s.*, d.name as department_name FROM staff s LEFT JOIN departments d ON s.department_id = d.id WHERE s.id = $1`,
      [req.params.id]
    );
    if (old.rows.length === 0) {
      return res.status(404).json({ error: 'Staff not found' });
    }
    const oldData = old.rows[0];

    const result = await query(
      `UPDATE staff SET
        title_th=$1, first_name_th=$2, last_name_th=$3, nickname_th=$4,
        first_name_en=$5, last_name_en=$6, nickname_en=$7, id_card_number=$8,
        passport_number=$9, date_of_birth=$10, department_id=$11, position=$12,
        hire_date=$13, status=$14, updated_at=NOW()
       WHERE id=$15 RETURNING *`,
      [title_th, first_name_th, last_name_th, nickname_th,
       first_name_en, last_name_en, nickname_en, id_card_number, passport_number,
       date_of_birth, department_id || null, position, hire_date, status, req.params.id]
    );

    // Log position/department changes
    const userId = req.user.id;
    if (oldData.position !== position) {
      await logHistory(req.params.id, 'position_change', 'ตำแหน่ง', oldData.position, position, userId);
    }
    if (String(oldData.department_id || '') !== String(department_id || '')) {
      // Get new department name
      let newDeptName = '-';
      if (department_id) {
        const dept = await query('SELECT name FROM departments WHERE id = $1', [department_id]);
        if (dept.rows.length > 0) newDeptName = dept.rows[0].name;
      }
      await logHistory(req.params.id, 'department_change', 'แผนก', oldData.department_name || '-', newDeptName, userId);
    }

    res.json({ data: result.rows[0], message: 'Staff updated successfully' });
  } catch (err) {
    console.error('Update staff error:', err);
    res.status(500).json({ error: 'Failed to update staff' });
  }
});

// DELETE /api/staff/:id
router.delete('/:id', authenticate, requirePermission('staff', 'delete'), async (req, res) => {
  try {
    const result = await query(
      `UPDATE staff SET status = 'inactive', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Staff not found' });
    }
    res.json({ message: 'Staff deactivated successfully' });
  } catch (err) {
    console.error('Delete staff error:', err);
    res.status(500).json({ error: 'Failed to delete staff' });
  }
});

module.exports = router;
