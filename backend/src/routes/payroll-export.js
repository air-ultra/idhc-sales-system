/**
 * Payroll export routes
 *   GET  /api/payroll-export/excel?year=2026&month=3
 *   GET  /api/payroll-export/pdf?year=2026&month=3
 *
 * Generates payroll report (Excel via exceljs, PDF via Python+ReportLab).
 * Pulls data from payroll JOIN staff JOIN staff_salary, groups by employee_type.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { generatePayrollExcel } = require('../utils/generate_payroll_excel');

const router = express.Router();

const TH_MONTHS = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                   'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function pad2(n) { return String(n).padStart(2, '0'); }

function lastDayOfMonth(year, month) {
  const ce = year > 2500 ? year - 543 : year;
  return new Date(ce, month, 0).getDate();
}

/**
 * Build the data object that both Excel and PDF generators consume.
 * Pulls payroll rows for the given (year, month), joins staff + staff_salary
 * (so we can group by employee_type), returns sorted: monthly first then daily,
 * each group ordered by employee_code.
 */
async function buildReportData(year, month) {
  const rows = await query(
    `SELECT
       p.id,
       p.year,
       p.month,
       p.salary,
       p.social_security,
       p.withholding_tax,
       p.bonus,
       p.overtime,
       p.other_income,
       p.other_deduction,
       p.net_pay,
       s.employee_code,
       s.first_name_th,
       s.last_name_th,
       s.id_card_number,
       COALESCE(ss.employee_type, 'monthly') AS employee_type
     FROM payroll p
     JOIN staff s ON s.id = p.staff_id
     LEFT JOIN staff_salary ss ON ss.staff_id = s.id
     WHERE p.year = $1 AND p.month = $2
     ORDER BY
       CASE COALESCE(ss.employee_type, 'monthly') WHEN 'monthly' THEN 0 ELSE 1 END,
       s.employee_code`,
    [year, month]
  );

  // Get company name (assume single company; later supports multi-company)
  let companyName = 'บริษัท';
  try {
    const cmp = await query(
      `SELECT value FROM settings WHERE key = 'company_name' LIMIT 1`
    );
    if (cmp.rows && cmp.rows[0]) companyName = cmp.rows[0].value;
  } catch (e) {
    // settings table may not exist; fall back
  }
  // Fallback for IDHC
  if (!companyName || companyName === 'บริษัท') {
    companyName = 'บริษัท ไอเดีย เฮ้าส์ เซ็นเตอร์ จำกัด';
  }

  const today = new Date();
  const reportDate = `${pad2(today.getDate())}/${pad2(today.getMonth() + 1)}/${today.getFullYear()}`;
  const lastDay = lastDayOfMonth(year, month);
  const payDate = `${pad2(lastDay)}/${pad2(month)}/${year}`;

  const items = (rows.rows || rows).map((r) => ({
    employee_code: r.employee_code,
    name: `${r.first_name_th || ''} ${r.last_name_th || ''}`.trim(),
    id_card_number: r.id_card_number || '',
    employee_type: r.employee_type || 'monthly',
    salary: Number(r.salary) || 0,
    overtime: Number(r.overtime) || 0,
    bonus: Number(r.bonus) || 0,
    other_income: Number(r.other_income) || 0,
    social_security: Number(r.social_security) || 0,
    withholding_tax: Number(r.withholding_tax) || 0,
    other_deduction: Number(r.other_deduction) || 0,
    net_pay: Number(r.net_pay) || 0,
  }));

  return {
    company_name: companyName,
    year: Number(year),
    month: Number(month),
    report_date: reportDate,
    pay_date: payDate,
    items,
  };
}

// ─── Excel ───
router.get('/excel', authenticate, async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ error: 'invalid year/month' });
    }
    const data = await buildReportData(year, month);
    if (data.items.length === 0) {
      return res.status(404).json({ error: 'no payroll for this period' });
    }
    const buf = await generatePayrollExcel(data);
    const filename = `PayrollReport_${year}_${pad2(month)}.xlsx`;
    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(Buffer.from(buf));
  } catch (e) {
    console.error('payroll-export/excel:', e);
    res.status(500).json({ error: 'export failed', detail: String(e.message || e) });
  }
});

// ─── PDF ───
router.get('/pdf', authenticate, async (req, res) => {
  let tmpJson = null;
  let tmpPdf = null;
  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ error: 'invalid year/month' });
    }
    const data = await buildReportData(year, month);
    if (data.items.length === 0) {
      return res.status(404).json({ error: 'no payroll for this period' });
    }

    const stamp = Date.now();
    tmpJson = path.join(os.tmpdir(), `payroll_${stamp}.json`);
    tmpPdf = path.join(os.tmpdir(), `payroll_${stamp}.pdf`);
    fs.writeFileSync(tmpJson, JSON.stringify(data), 'utf8');

    const scriptPath = path.join(__dirname, '..', 'utils', 'generate_payroll_pdf.py');
    execSync(`cat "${tmpJson}" | python3 "${scriptPath}" "${tmpPdf}"`, { stdio: 'pipe' });

    const pdfBuf = fs.readFileSync(tmpPdf);
    const filename = `PayrollReport_${year}_${pad2(month)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(pdfBuf);
  } catch (e) {
    console.error('payroll-export/pdf:', e);
    res.status(500).json({ error: 'export failed', detail: String(e.message || e) });
  } finally {
    try { if (tmpJson && fs.existsSync(tmpJson)) fs.unlinkSync(tmpJson); } catch {}
    try { if (tmpPdf && fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf); } catch {}
  }
});

module.exports = router;
