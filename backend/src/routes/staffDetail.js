const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();

// File upload config
const uploadDir = '/app/uploads/documents';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `staff-${req.params.id}-${Date.now()}${ext}`;
    cb(null, name);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, allowed.includes(ext));
}});

// Helper: log history
async function logHistory(staffId, changeType, field, oldVal, newVal, userId) {
  if (String(oldVal || '') === String(newVal || '')) return;
  await query(
    `INSERT INTO staff_history (staff_id, change_type, field_changed, old_value, new_value, changed_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [staffId, changeType, field, String(oldVal || ''), String(newVal || ''), userId]
  );
}

// ============ CONTACT ============
router.get('/:id/contact', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM staff_contact WHERE staff_id = $1', [req.params.id]);
    res.json({ data: result.rows[0] || null });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch contact' }); }
});

router.put('/:id/contact', authenticate, requirePermission('staff', 'edit'), async (req, res) => {
  try {
    const { mobile_phone, email, line_id, address, emergency_contact_name, emergency_contact_phone } = req.body;
    const existing = await query('SELECT id FROM staff_contact WHERE staff_id = $1', [req.params.id]);
    let result;
    if (existing.rows.length > 0) {
      result = await query(
        `UPDATE staff_contact SET mobile_phone=$1, email=$2, line_id=$3, address=$4, 
         emergency_contact_name=$5, emergency_contact_phone=$6, updated_at=NOW() WHERE staff_id=$7 RETURNING *`,
        [mobile_phone, email, line_id, address, emergency_contact_name, emergency_contact_phone, req.params.id]
      );
    } else {
      result = await query(
        `INSERT INTO staff_contact (staff_id, mobile_phone, email, line_id, address, emergency_contact_name, emergency_contact_phone)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [req.params.id, mobile_phone, email, line_id, address, emergency_contact_name, emergency_contact_phone]
      );
    }
    res.json({ data: result.rows[0], message: 'บันทึกข้อมูลติดต่อสำเร็จ' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to save contact' }); }
});

// ============ ADDRESS ============
router.get('/:id/address', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM staff_address WHERE staff_id = $1', [req.params.id]);
    res.json({ data: result.rows[0] || null });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch address' }); }
});

router.put('/:id/address', authenticate, requirePermission('staff', 'edit'), async (req, res) => {
  try {
    const { house_no, moo, soi, intersection, road, sub_district, district, province, postal_code } = req.body;
    const existing = await query('SELECT id FROM staff_address WHERE staff_id = $1', [req.params.id]);
    let result;
    if (existing.rows.length > 0) {
      result = await query(
        `UPDATE staff_address SET house_no=$1, moo=$2, soi=$3, intersection=$4, road=$5,
         sub_district=$6, district=$7, province=$8, postal_code=$9, updated_at=NOW() WHERE staff_id=$10 RETURNING *`,
        [house_no, moo, soi, intersection, road, sub_district, district, province, postal_code, req.params.id]
      );
    } else {
      result = await query(
        `INSERT INTO staff_address (staff_id, house_no, moo, soi, intersection, road, sub_district, district, province, postal_code)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [req.params.id, house_no, moo, soi, intersection, road, sub_district, district, province, postal_code]
      );
    }
    res.json({ data: result.rows[0], message: 'บันทึกที่อยู่สำเร็จ' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to save address' }); }
});

// ============ EMPLOYMENT ============
router.get('/:id/employment', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM staff_employment WHERE staff_id = $1', [req.params.id]);
    res.json({ data: result.rows[0] || null });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch employment' }); }
});

router.put('/:id/employment', authenticate, requirePermission('staff', 'edit'), async (req, res) => {
  try {
    const { hire_date, department, position, payment_channel, bank_name, bank_account_no, bank_account_type, bank_branch } = req.body;
    const staffId = req.params.id;
    const userId = req.user.id;

    // Get old data for history
    const oldResult = await query('SELECT * FROM staff_employment WHERE staff_id = $1', [staffId]);
    const oldData = oldResult.rows[0] || {};

    const existing = await query('SELECT id FROM staff_employment WHERE staff_id = $1', [staffId]);
    let result;
    if (existing.rows.length > 0) {
      result = await query(
        `UPDATE staff_employment SET hire_date=$1, department=$2, position=$3, payment_channel=$4,
         bank_name=$5, bank_account_no=$6, bank_account_type=$7, bank_branch=$8, updated_at=NOW() WHERE staff_id=$9 RETURNING *`,
        [hire_date, department, position, payment_channel, bank_name, bank_account_no, bank_account_type, bank_branch, staffId]
      );
    } else {
      result = await query(
        `INSERT INTO staff_employment (staff_id, hire_date, department, position, payment_channel, bank_name, bank_account_no, bank_account_type, bank_branch)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [staffId, hire_date, department, position, payment_channel, bank_name, bank_account_no, bank_account_type, bank_branch]
      );
    }

    // Auto log position/department changes
    await logHistory(staffId, 'position_change', 'ตำแหน่ง', oldData.position, position, userId);
    await logHistory(staffId, 'department_change', 'แผนก', oldData.department, department, userId);

    res.json({ data: result.rows[0], message: 'บันทึกข้อมูลการจ้างงานสำเร็จ' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to save employment' }); }
});

// ============ SALARY (with auto history log) ============
router.get('/:id/salary', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM staff_salary WHERE staff_id = $1', [req.params.id]);
    res.json({ data: result.rows[0] || null });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch salary' }); }
});

router.put('/:id/salary', authenticate, requirePermission('staff', 'edit'), async (req, res) => {
  try {
    const { employee_type, salary, social_security_eligible, social_security, withholding_tax, auto_calc_tax, tax_condition, remarks, ss_rate, ss_max_salary } = req.body;
    const staffId = req.params.id;
    const userId = req.user.id;

    // Get old salary data for history
    const oldResult = await query('SELECT * FROM staff_salary WHERE staff_id = $1', [staffId]);
    const oldData = oldResult.rows[0] || {};

    const existing = await query('SELECT id FROM staff_salary WHERE staff_id = $1', [staffId]);
    let result;
    if (existing.rows.length > 0) {
      result = await query(
        `UPDATE staff_salary SET employee_type=$1, salary=$2, social_security_eligible=$3, social_security=$4,
         withholding_tax=$5, auto_calc_tax=$6, tax_condition=$7, remarks=$8, ss_rate=$9, ss_max_salary=$10, updated_at=NOW() WHERE staff_id=$11 RETURNING *`,
        [employee_type, salary, social_security_eligible, social_security, withholding_tax, auto_calc_tax, tax_condition, remarks, ss_rate, ss_max_salary, staffId]
      );
    } else {
      result = await query(
        `INSERT INTO staff_salary (staff_id, employee_type, salary, social_security_eligible, social_security, withholding_tax, auto_calc_tax, tax_condition, remarks, ss_rate, ss_max_salary)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [staffId, employee_type, salary, social_security_eligible, social_security, withholding_tax, auto_calc_tax, tax_condition, remarks, ss_rate, ss_max_salary]
      );
    }

    // Auto log salary changes
    await logHistory(staffId, 'salary_change', 'เงินเดือน', oldData.salary, salary, userId);
    await logHistory(staffId, 'salary_change', 'ประกันสังคม', oldData.social_security, social_security, userId);
    await logHistory(staffId, 'salary_change', 'หัก ณ ที่จ่าย', oldData.withholding_tax, withholding_tax, userId);
    await logHistory(staffId, 'salary_change', 'ประเภทพนักงาน', oldData.employee_type, employee_type, userId);

    res.json({ data: result.rows[0], message: 'บันทึกข้อมูลเงินเดือนสำเร็จ' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to save salary' }); }
});

// ============ HISTORY ============
router.get('/:id/history', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT sh.*, u.username as changed_by_name FROM staff_history sh 
       LEFT JOIN users u ON sh.changed_by = u.id WHERE sh.staff_id = $1 ORDER BY sh.changed_at DESC`,
      [req.params.id]
    );
    res.json({ data: result.rows });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch history' }); }
});

// ============ NOTES ============
router.get('/:id/notes', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT sn.*, u.username as created_by_name FROM staff_notes sn 
       LEFT JOIN users u ON sn.created_by = u.id WHERE sn.staff_id = $1 ORDER BY sn.created_at DESC`,
      [req.params.id]
    );
    res.json({ data: result.rows });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch notes' }); }
});

router.post('/:id/notes', authenticate, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });
    const result = await query(
      `INSERT INTO staff_notes (staff_id, content, created_by) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, content, req.user.id]
    );
    res.status(201).json({ data: result.rows[0], message: 'เพิ่มหมายเหตุสำเร็จ' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create note' }); }
});

// ============ DOCUMENTS ============
router.get('/:id/documents', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT sd.*, u.username as uploaded_by_name FROM staff_documents sd
       LEFT JOIN users u ON sd.uploaded_by = u.id WHERE sd.staff_id = $1 ORDER BY sd.uploaded_at DESC`,
      [req.params.id]
    );
    res.json({ data: result.rows });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch documents' }); }
});

router.post('/:id/documents', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'กรุณาเลือกไฟล์' });
    const { document_type } = req.body;
    const result = await query(
      `INSERT INTO staff_documents (staff_id, document_type, file_name, file_path, mime_type, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.params.id, document_type || 'อื่นๆ', req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, req.user.id]
    );
    res.status(201).json({ data: result.rows[0], message: 'อัพโหลดเอกสารสำเร็จ' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to upload document' }); }
});

router.delete('/:id/documents/:docId', authenticate, requirePermission('staff', 'edit'), async (req, res) => {
  try {
    const doc = await query('SELECT * FROM staff_documents WHERE id = $1 AND staff_id = $2', [req.params.docId, req.params.id]);
    if (doc.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    // Delete file
    const filePath = path.join(uploadDir, doc.rows[0].file_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await query('DELETE FROM staff_documents WHERE id = $1', [req.params.docId]);
    res.json({ message: 'ลบเอกสารสำเร็จ' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to delete document' }); }
});

// Serve uploaded files
router.get('/documents/file/:filename', (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

module.exports = router;
