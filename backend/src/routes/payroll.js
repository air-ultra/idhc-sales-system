const express = require('express');
const { query } = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();

/* ============================================================
 * Tax Calculation Helpers (Phase 2.10.1 — 2026-04-29)
 * ============================================================ */

const TAX_BRACKETS = [
  { min: 0,       max: 150000,    rate: 0 },
  { min: 150000,  max: 300000,    rate: 0.05 },
  { min: 300000,  max: 500000,    rate: 0.10 },
  { min: 500000,  max: 750000,    rate: 0.15 },
  { min: 750000,  max: 1000000,   rate: 0.20 },
  { min: 1000000, max: 2000000,   rate: 0.25 },
  { min: 2000000, max: 5000000,   rate: 0.30 },
  { min: 5000000, max: Infinity,  rate: 0.35 },
];

function calcProgressiveTax(netIncome) {
  let tax = 0;
  for (const b of TAX_BRACKETS) {
    if (netIncome <= b.min) break;
    const taxable = Math.min(netIncome, b.max) - b.min;
    tax += taxable * b.rate;
  }
  return Math.round(tax);
}

/**
 * คำนวณ wht รายเดือนสำหรับ staff คนหนึ่งในเดือน/ปีที่กำหนด
 * past = SUM(salary) จาก payroll WHERE year=Y AND month<>M
 * projected = currentSalary × (12 - monthsPast)
 * yearlyIncome = past + projected → progressive → /12
 */
async function calcWhtForGenerate(staffId, year, month, currentSalary, ssMonthly, ssEligible) {
  try {
    const past = await query(
      `SELECT salary FROM payroll WHERE staff_id=$1 AND year=$2 AND month<>$3`,
      [staffId, year, month]
    );
    const pastSalary = past.rows.reduce((sum, r) => sum + (parseFloat(r.salary) || 0), 0);
    const monthsPast = past.rows.length;
    const remainingMonths = Math.max(12 - monthsPast, 0);
    const projected = (parseFloat(currentSalary) || 0) * remainingMonths;

    const yearlyIncome = pastSalary + projected;
    const expense = Math.min(yearlyIncome * 0.5, 100000);
    const personal = 60000;
    const ssYearly = ssEligible ? (parseFloat(ssMonthly) || 0) * 12 : 0;
    const netIncome = Math.max(yearlyIncome - expense - personal - ssYearly, 0);
    const yearlyTax = calcProgressiveTax(netIncome);
    return { wht: Math.round(yearlyTax / 12), monthsPast, remainingMonths, yearlyIncome, yearlyTax };
  } catch (e) {
    console.error('calcWhtForGenerate error:', e);
    return null;
  }
}


// GET /api/payroll?year=&month=
router.get('/', authenticate, async (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) return res.status(400).json({ error: 'Year and month are required' });
    const result = await query(
      `SELECT p.*, s.employee_code, s.first_name_th, s.last_name_th, s.title_th,
              d.name as department_name, s.position,
              u1.username as created_by_name, u2.username as approved_by_name
       FROM payroll p
       JOIN staff s ON p.staff_id = s.id
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN users u1 ON p.created_by = u1.id
       LEFT JOIN users u2 ON p.approved_by = u2.id
       WHERE p.year = $1 AND p.month = $2
       ORDER BY s.employee_code`,
      [year, month]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch payroll' });
  }
});

// POST /api/payroll/generate - Generate payroll for a month
router.post('/generate', authenticate, async (req, res) => {
  try {
    const { year, month } = req.body;
    if (!year || !month) return res.status(400).json({ error: 'Year and month are required' });

    // Check if already exists
    const existing = await query('SELECT COUNT(*) FROM payroll WHERE year = $1 AND month = $2', [year, month]);
    if (parseInt(existing.rows[0].count) > 0) {
      return res.status(400).json({ error: `รายการเงินเดือน ${month}/${year} มีอยู่แล้ว` });
    }

    // Get all active staff with salary info (รวม auto_calc_tax สำหรับ recalc)
    const staffResult = await query(
      `SELECT s.id as staff_id, ss.salary, ss.social_security, ss.withholding_tax,
              ss.social_security_eligible, ss.auto_calc_tax
       FROM staff s
       LEFT JOIN staff_salary ss ON ss.staff_id = s.id
       WHERE s.status = 'active'`
    );

    if (staffResult.rows.length === 0) {
      return res.status(400).json({ error: 'ไม่มีพนักงาน active' });
    }

    let count = 0;
    for (const staff of staffResult.rows) {
      const salary = parseFloat(staff.salary) || 0;
      const ss = parseFloat(staff.social_security) || 0;
      let tax = parseFloat(staff.withholding_tax) || 0;

      // ถ้า auto_calc_tax=true → recalc wht จาก payroll history + projection
      if (staff.auto_calc_tax === true) {
        const calc = await calcWhtForGenerate(
          staff.staff_id, year, month, salary, ss, staff.social_security_eligible === true
        );
        if (calc) tax = calc.wht;
      }

      const netPay = salary - ss - tax;

      await query(
        `INSERT INTO payroll (staff_id, year, month, salary, social_security, withholding_tax, net_pay, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (staff_id, year, month) DO NOTHING`,
        [staff.staff_id, year, month, salary, ss, tax, netPay, req.user.id]
      );
      count++;
    }

    res.status(201).json({ message: `สร้างรายการเงินเดือน ${month}/${year} สำเร็จ (${count} คน)` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate payroll' });
  }
});

// PUT /api/payroll/:id - Update payroll item
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { bonus, overtime, other_income, other_deduction } = req.body;

    // Get current record
    const current = await query('SELECT * FROM payroll WHERE id = $1', [req.params.id]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const row = current.rows[0];
    const b = parseFloat(bonus) || 0;
    const ot = parseFloat(overtime) || 0;
    const oi = parseFloat(other_income) || 0;
    const od = parseFloat(other_deduction) || 0;
    const netPay = parseFloat(row.salary) + b + ot + oi - parseFloat(row.social_security) - parseFloat(row.withholding_tax) - od;

    const result = await query(
      `UPDATE payroll SET bonus=$1, overtime=$2, other_income=$3, other_deduction=$4, net_pay=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [b, ot, oi, od, netPay, req.params.id]
    );
    res.json({ data: result.rows[0], message: 'อัปเดตสำเร็จ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update payroll' });
  }
});

// PUT /api/payroll/approve/:year/:month - Approve entire month
router.put('/approve/:year/:month', authenticate, async (req, res) => {
  try {
    await query(
      `UPDATE payroll SET status = 'approved', approved_by = $1, updated_at = NOW()
       WHERE year = $2 AND month = $3 AND status = 'draft'`,
      [req.user.id, req.params.year, req.params.month]
    );
    res.json({ message: `อนุมัติเงินเดือน ${req.params.month}/${req.params.year} สำเร็จ` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve payroll' });
  }
});
// PUT /api/payroll/unapprove/:year/:month - Cancel approval (revert to draft)
router.put('/unapprove/:year/:month', authenticate, async (req, res) => {
  try {
    const result = await query(
      `UPDATE payroll SET status = 'draft', approved_by = NULL, updated_at = NOW()
       WHERE year = $1 AND month = $2 AND status = 'approved'`,
      [req.params.year, req.params.month]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'ไม่มีรายการที่อนุมัติแล้วในเดือนนี้' });
    }
    res.json({ message: `ยกเลิกการอนุมัติเงินเดือน ${req.params.month}/${req.params.year} สำเร็จ (${result.rowCount} รายการ)` });
  } catch (err) {
    console.error('unapprove payroll:', err);
    res.status(500).json({ error: 'Failed to unapprove payroll' });
  }
});


// GET /api/payroll/staff/:staffId - Get payroll history for a staff member
router.get('/staff/:staffId', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, u1.username as created_by_name, u2.username as approved_by_name
       FROM payroll p
       LEFT JOIN users u1 ON p.created_by = u1.id
       LEFT JOIN users u2 ON p.approved_by = u2.id
       WHERE p.staff_id = $1
       ORDER BY p.year DESC, p.month DESC`,
      [req.params.staffId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payroll history' });
  }
});

// GET /api/payroll/cert/:staffId/:year - Get/Generate 50 Tawi cert data
router.get('/cert/:staffId/:year', authenticate, async (req, res) => {
  try {
    const { staffId, year } = req.params;

    // Get staff info
    const staffRes = await query(
      `SELECT s.*, d.name as department_name, sc.address,
              sa.house_no, sa.moo, sa.soi, sa.road, sa.sub_district, sa.district, sa.province, sa.postal_code
       FROM staff s
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN staff_contact sc ON sc.staff_id = s.id
       LEFT JOIN staff_address sa ON sa.staff_id = s.id
       WHERE s.id = $1`,
      [staffId]
    );
    if (staffRes.rows.length === 0) return res.status(404).json({ error: 'Staff not found' });

    // Get yearly payroll summary
    const payrollRes = await query(
      `SELECT 
        SUM(salary + bonus + overtime + other_income) as total_income,
        SUM(withholding_tax) as total_tax,
        SUM(social_security) as total_social_security,
        COUNT(*) as months_count
       FROM payroll
       WHERE staff_id = $1 AND year = $2 AND status = 'approved'`,
      [staffId, year]
    );

    // Get monthly breakdown
    const monthlyRes = await query(
      `SELECT month, salary, bonus, overtime, other_income, social_security, withholding_tax, net_pay
       FROM payroll WHERE staff_id = $1 AND year = $2 ORDER BY month`,
      [staffId, year]
    );

    res.json({
      staff: staffRes.rows[0],
      summary: payrollRes.rows[0],
      monthly: monthlyRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch cert data' });
  }
});

// DELETE /api/payroll/:id - Delete single payroll item
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const record = await query('SELECT * FROM payroll WHERE id = $1', [req.params.id]);
    if (record.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (record.rows[0].status === 'approved') return res.status(400).json({ error: 'ไม่สามารถลบรายการที่อนุมัติแล้ว' });
    await query('DELETE FROM payroll WHERE id = $1', [req.params.id]);
    res.json({ message: 'ลบรายการสำเร็จ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete payroll item' });
  }
});

// DELETE /api/payroll/month/:year/:month - Delete entire month
router.delete('/month/:year/:month', authenticate, async (req, res) => {
  try {
    const { year, month } = req.params;
    const approved = await query('SELECT COUNT(*) FROM payroll WHERE year=$1 AND month=$2 AND status=\'approved\'', [year, month]);
    if (parseInt(approved.rows[0].count) > 0) return res.status(400).json({ error: 'ไม่สามารถลบได้ มีรายการที่อนุมัติแล้ว' });
    const result = await query('DELETE FROM payroll WHERE year=$1 AND month=$2', [year, month]);
    res.json({ message: `ลบรายการเงินเดือน ${month}/${year} สำเร็จ (${result.rowCount} รายการ)` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete payroll month' });
  }
});

// POST /api/payroll/add-single - Add single staff to payroll
router.post('/add-single', authenticate, async (req, res) => {
  try {
    const { staff_id, year, month } = req.body;
    if (!staff_id || !year || !month) return res.status(400).json({ error: 'staff_id, year, month are required' });

    const existing = await query('SELECT id FROM payroll WHERE staff_id=$1 AND year=$2 AND month=$3', [staff_id, year, month]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'พนักงานนี้มีรายการในเดือนนี้แล้ว' });

    const staffSalary = await query('SELECT * FROM staff_salary WHERE staff_id = $1', [staff_id]);
    const ss = staffSalary.rows[0] || {};
    const salary = parseFloat(ss.salary) || 0;
    const socialSecurity = parseFloat(ss.social_security) || 0;
    let tax = parseFloat(ss.withholding_tax) || 0;

    // ถ้า auto_calc_tax=true → recalc wht
    if (ss.auto_calc_tax === true) {
      const calc = await calcWhtForGenerate(
        staff_id, year, month, salary, socialSecurity, ss.social_security_eligible === true
      );
      if (calc) tax = calc.wht;
    }

    const netPay = salary - socialSecurity - tax;

    const result = await query(
      `INSERT INTO payroll (staff_id, year, month, salary, social_security, withholding_tax, net_pay, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [staff_id, year, month, salary, socialSecurity, tax, netPay, req.user.id]
    );
    res.status(201).json({ data: result.rows[0], message: 'เพิ่มรายการสำเร็จ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add payroll item' });
  }
});

module.exports = router;
