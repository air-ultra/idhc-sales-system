/**
 * Payroll documents routes — Pay Slip and SSO 1-10
 *
 *   GET /api/payroll-documents/payslip?year=2026&month=4              (all employees, PDF)
 *   GET /api/payroll-documents/payslip?year=2026&month=4&staff_id=5   (single employee, PDF)
 *   GET /api/payroll-documents/sso?year=2026&month=4                  (PDF — สวยๆ สำหรับเก็บ)
 *   GET /api/payroll-documents/sso/excel?year=2026&month=4            (Excel — e-Filing format)
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { generateSSOExcel } = require('../utils/generate_sso_excel');

const router = express.Router();

function pad2(n) { return String(n).padStart(2, '0'); }

function lastDayOfMonth(year, month) {
  const ce = year > 2500 ? year - 543 : year;
  return new Date(ce, month, 0).getDate();
}

async function getCompanyName() {
  try {
    const r = await query(
      `SELECT value FROM settings WHERE key = 'company_name' LIMIT 1`
    );
    if (r.rows && r.rows[0] && r.rows[0].value) return r.rows[0].value;
  } catch (e) { /* ignore */ }
  return 'บริษัท ไอเดีย เฮ้าส์ เซ็นเตอร์ จำกัด';
}

/**
 * Run Python PDF generator with given data and return Buffer.
 */
function runPython(scriptName, data) {
  const stamp = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const tmpJson = path.join(os.tmpdir(), `${scriptName}_${stamp}.json`);
  const tmpPdf = path.join(os.tmpdir(), `${scriptName}_${stamp}.pdf`);
  try {
    fs.writeFileSync(tmpJson, JSON.stringify(data), 'utf8');
    const scriptPath = path.join(__dirname, '..', 'utils', `generate_${scriptName}_pdf.py`);
    execSync(`cat "${tmpJson}" | python3 "${scriptPath}" "${tmpPdf}"`, { stdio: 'pipe' });
    return fs.readFileSync(tmpPdf);
  } finally {
    try { if (fs.existsSync(tmpJson)) fs.unlinkSync(tmpJson); } catch {}
    try { if (fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf); } catch {}
  }
}

/**
 * Fetch insured employees for the period (used by both SSO PDF and Excel routes).
 * Returns array shaped for the generators:
 *   [{ employee_code, title, name, first_name, last_name, id_card_number, salary, contribution }]
 *
 * NOTE: salary here = ค่าจ้างจริงที่จ่าย (ไม่ใช่ค่าจ้างที่ใช้คำนวณหลัง cap)
 *       เพราะ e-Filing ต้องการค่าจ้างจริง — ส่วน contribution คำนวณจาก capped wage แล้ว
 */
async function fetchInsuredEmployees(year, month) {
  const sql = `
    SELECT
      p.salary, p.social_security,
      s.employee_code, s.title_th,
      s.first_name_th, s.last_name_th, s.id_card_number,
      ss.ss_max_salary,
      ss.social_security_eligible
    FROM payroll p
    JOIN staff s ON s.id = p.staff_id
    LEFT JOIN staff_salary ss ON ss.staff_id = s.id
    WHERE p.year = $1 AND p.month = $2
      AND (ss.social_security_eligible = true OR p.social_security > 0)
    ORDER BY s.employee_code`;

  const result = await query(sql, [year, month]);
  const rows = result.rows || result;

  return rows.map((r) => ({
    employee_code: r.employee_code,
    title: r.title_th || '',
    first_name: r.first_name_th || '',
    last_name: r.last_name_th || '',
    name: `${r.first_name_th || ''} ${r.last_name_th || ''}`.trim(),
    id_card_number: r.id_card_number || '',
    salary: Number(r.salary) || 0,                  // ค่าจ้างจริง (สำหรับ e-Filing)
    contribution: Number(r.social_security) || 0,   // เงินสมทบ (คำนวณตอนสร้าง payroll แล้ว)
    // เก็บ wage หลัง cap แยกไว้ เผื่อ PDF ต้องใช้
    capped_salary: Math.min(Number(r.salary) || 0, Number(r.ss_max_salary) || 17500),
  }));
}

// ════════════════════════════════════════════════════
// PAY SLIP — รวมทั้งเดือน (PDF, 2 slips/page) หรือคนเดียว
// ════════════════════════════════════════════════════
router.get('/payslip', authenticate, async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    const staffId = req.query.staff_id ? parseInt(req.query.staff_id, 10) : null;

    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ error: 'invalid year/month' });
    }

    const params = [year, month];
    let staffFilter = '';
    if (staffId) {
      staffFilter = ' AND s.id = $3';
      params.push(staffId);
    }

    const sql = `
      SELECT
        p.id, p.salary, p.social_security, p.withholding_tax,
        p.bonus, p.overtime, p.other_income, p.other_deduction, p.net_pay,
        s.id AS staff_id, s.employee_code, s.title_th,
        s.first_name_th, s.last_name_th, s.id_card_number, s.position,
        d.name AS department_name,
        se.bank_name, se.bank_account_no
      FROM payroll p
      JOIN staff s ON s.id = p.staff_id
      LEFT JOIN departments d ON d.id = s.department_id
      LEFT JOIN staff_employment se ON se.staff_id = s.id
      WHERE p.year = $1 AND p.month = $2 ${staffFilter}
      ORDER BY s.employee_code`;

    const result = await query(sql, params);
    const rows = result.rows || result;

    if (rows.length === 0) {
      return res.status(404).json({ error: 'no payroll for this period' });
    }

    const lastDay = lastDayOfMonth(year, month);
    const today = new Date();
    const reportDate = `${pad2(today.getDate())}/${pad2(today.getMonth() + 1)}/${today.getFullYear()}`;
    const payDate = `${pad2(lastDay)}/${pad2(month)}/${year}`;

    const items = rows.map((r) => ({
      employee_code: r.employee_code,
      title: r.title_th || '',
      name: `${r.first_name_th || ''} ${r.last_name_th || ''}`.trim(),
      id_card_number: r.id_card_number || '',
      department: r.department_name || '',
      position: r.position || '',
      bank_name: r.bank_name || '',
      bank_account_no: r.bank_account_no || '',
      salary: Number(r.salary) || 0,
      overtime: Number(r.overtime) || 0,
      bonus: Number(r.bonus) || 0,
      other_income: Number(r.other_income) || 0,
      social_security: Number(r.social_security) || 0,
      withholding_tax: Number(r.withholding_tax) || 0,
      other_deduction: Number(r.other_deduction) || 0,
    }));

    const data = {
      company_name: await getCompanyName(),
      year, month,
      report_date: reportDate,
      pay_date: payDate,
      items,
    };

    const pdfBuf = runPython('payslip', data);
    const filename = staffId
      ? `PaySlip_${rows[0].employee_code}_${year}_${pad2(month)}.pdf`
      : `PaySlips_${year}_${pad2(month)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(pdfBuf);
  } catch (e) {
    console.error('payslip:', e);
    res.status(500).json({ error: 'pay slip generation failed', detail: String(e.message || e) });
  }
});

// ════════════════════════════════════════════════════
// SSO 1-10 PDF — สวยๆ สำหรับเก็บแฟ้ม
// ใช้ค่าจ้างหลัง cap (capped_salary) เพื่อให้ตรงกับยอดเงินสมทบ
// ════════════════════════════════════════════════════
router.get('/sso', authenticate, async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ error: 'invalid year/month' });
    }

    const employees = await fetchInsuredEmployees(year, month);
    if (employees.length === 0) {
      return res.status(404).json({ error: 'no insured employees for this period' });
    }

    const today = new Date();
    const reportDate = `${pad2(today.getDate())}/${pad2(today.getMonth() + 1)}/${today.getFullYear()}`;

    // PDF: ใช้ capped_salary (ค่าจ้างที่ใช้คำนวณ — หลัง cap)
    const items = employees.map((e) => ({
      employee_code: e.employee_code,
      title: e.title,
      name: e.name,
      id_card_number: e.id_card_number,
      salary: e.capped_salary,
      contribution: e.contribution,
    }));

    const data = {
      company_name: await getCompanyName(),
      year, month,
      report_date: reportDate,
      employer_account_no: '',
      items,
    };

    const pdfBuf = runPython('sso', data);
    const filename = `SSO_1-10_${year}_${pad2(month)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(pdfBuf);
  } catch (e) {
    console.error('sso (pdf):', e);
    res.status(500).json({ error: 'SSO 1-10 PDF generation failed', detail: String(e.message || e) });
  }
});

// ════════════════════════════════════════════════════
// SSO 1-10 EXCEL — format e-Filing สำหรับอัพโหลดเข้าเว็บ สปส.
// ใช้ค่าจ้างจริง (salary) — สปส. ต้องการค่าจ้างจริง ระบบจะคำนวณ cap เอง
// ════════════════════════════════════════════════════
router.get('/sso/excel', authenticate, async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ error: 'invalid year/month' });
    }

    const employees = await fetchInsuredEmployees(year, month);
    if (employees.length === 0) {
      return res.status(404).json({ error: 'no insured employees for this period' });
    }

    // Excel: ใช้ salary จริง (ไม่ cap) ตาม spec e-Filing
    const items = employees.map((e) => ({
      id_card_number: e.id_card_number,
      title: e.title,
      first_name: e.first_name,
      last_name: e.last_name,
      salary: e.salary,                // ค่าจ้างจริง
      contribution: e.contribution,    // เงินสมทบ (คำนวณจาก capped wage แล้ว)
    }));

    const buf = await generateSSOExcel({ items });
    const filename = `SSO_1-10_${year}_${pad2(month)}.xlsx`;
    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(Buffer.from(buf));
  } catch (e) {
    console.error('sso (excel):', e);
    res.status(500).json({ error: 'SSO 1-10 Excel generation failed', detail: String(e.message || e) });
  }
});

module.exports = router;
