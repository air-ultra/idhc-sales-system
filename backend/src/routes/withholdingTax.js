const express = require('express');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const router = express.Router();

// ─── Thai number to words ───
const DIGITS = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const POSITIONS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

function intToThai(n) {
  if (n === 0) return 'ศูนย์';
  const s = String(n);
  const len = s.length;
  let result = '';
  for (let i = 0; i < len; i++) {
    const d = parseInt(s[i]);
    const pos = len - 1 - i;
    if (d === 0) continue;
    if (pos === 0 && d === 1 && len > 1) { result += 'เอ็ด'; continue; }
    if (pos === 1 && d === 2) { result += 'ยี่สิบ'; continue; }
    if (pos === 1 && d === 1) { result += 'สิบ'; continue; }
    result += DIGITS[d] + POSITIONS[pos];
  }
  return result;
}

function thaiAmountWords(amount) {
  const [intPart, decPart = '00'] = String(Math.abs(amount).toFixed(2)).split('.');
  const baht = parseInt(intPart);
  const satang = parseInt(decPart);
  let text = baht > 0 ? intToThai(baht) + 'บาท' : 'ศูนย์บาท';
  text += satang > 0 ? intToThai(satang) + 'สตางค์' : 'ถ้วน';
  return `(${text})`;
}

// ─── Generate doc_no ───
async function generateDocNo() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const result = await query("SELECT nextval('wht_doc_seq') AS seq");
  const seq = String(result.rows[0].seq).padStart(4, '0');
  return `WT${yyyy}${mm}${seq}`;
}

// ─── LIST ───
router.get('/', authenticate, async (req, res) => {
  try {
    const { year, status, staff_id } = req.query;
    let sql = `SELECT w.*, s.first_name_th || ' ' || s.last_name_th AS staff_name
               FROM withholding_tax w
               LEFT JOIN staff s ON w.staff_id = s.id
               WHERE 1=1`;
    const params = [];
    if (year) { params.push(year); sql += ` AND w.tax_year = $${params.length}`; }
    if (status) { params.push(status); sql += ` AND w.status = $${params.length}`; }
    if (staff_id) { params.push(staff_id); sql += ` AND w.staff_id = $${params.length}`; }
    sql += ' ORDER BY w.created_at DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('WHT list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET BY ID ───
router.get('/:id', authenticate, async (req, res) => {
  try {
    const wht = await query('SELECT * FROM withholding_tax WHERE id = $1', [req.params.id]);
    if (!wht.rows.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    const items = await query('SELECT * FROM withholding_tax_items WHERE wht_id = $1 ORDER BY id', [req.params.id]);
    res.json({ ...wht.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CREATE ───
router.post('/', authenticate, async (req, res) => {
  try {
    const d = req.body;
    const doc_no = await generateDocNo();
    const tax_words = thaiAmountWords(d.total_tax || 0);
    
    const result = await query(`
      INSERT INTO withholding_tax
        (doc_no, book_no, tax_year, copy_no, issue_date,
         payer_name, payer_tax_id, payer_address,
         staff_id, payee_name, payee_tax_id, payee_address,
         pnd_form, pnd_seq, income_type, income_desc,
         total_income, total_tax, tax_words,
         fund_gpf, fund_sso, fund_pvf,
         withhold_method, status, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
      RETURNING *
    `, [
      doc_no, d.book_no || '', d.tax_year, d.copy_no || 1, d.issue_date,
      d.payer_name, d.payer_tax_id, d.payer_address,
      d.staff_id || null, d.payee_name, d.payee_tax_id, d.payee_address,
      d.pnd_form, d.pnd_seq || 1, d.income_type, d.income_desc || '',
      d.total_income || 0, d.total_tax || 0, tax_words,
      d.fund_gpf || 0, d.fund_sso || 0, d.fund_pvf || 0,
      d.withhold_method || 1, 'draft', req.user.id
    ]);
    
    const wht_id = result.rows[0].id;
    
    // Insert items
    if (d.items && d.items.length) {
      for (const item of d.items) {
        await query(`
          INSERT INTO withholding_tax_items (wht_id, pay_date, income_amount, tax_amount, description, pnd_form, income_type)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [wht_id, item.pay_date, item.income_amount, item.tax_amount, item.description || '', item.pnd_form || '', item.income_type || '']);
      }
    }
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('WHT create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── UPDATE (draft only) ───
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const existing = await query('SELECT status FROM withholding_tax WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    if (existing.rows[0].status !== 'draft') return res.status(400).json({ error: 'แก้ไขได้เฉพาะเอกสาร draft' });
    
    const d = req.body;
    const tax_words = d.total_tax ? thaiAmountWords(d.total_tax) : undefined;
    
    await query(`
      UPDATE withholding_tax SET
        payee_name = COALESCE($1, payee_name),
        payee_tax_id = COALESCE($2, payee_tax_id),
        payee_address = COALESCE($3, payee_address),
        pnd_form = COALESCE($4, pnd_form),
        income_type = COALESCE($5, income_type),
        total_income = COALESCE($6, total_income),
        total_tax = COALESCE($7, total_tax),
        tax_words = COALESCE($8, tax_words),
        withhold_method = COALESCE($9, withhold_method),
        updated_at = NOW()
      WHERE id = $10
    `, [
      d.payee_name, d.payee_tax_id, d.payee_address,
      d.pnd_form, d.income_type,
      d.total_income, d.total_tax, tax_words,
      d.withhold_method, req.params.id
    ]);
    
    // Update items: delete old + insert new
    if (d.items && d.items.length) {
      await query('DELETE FROM withholding_tax_items WHERE wht_id = $1', [req.params.id]);
      for (const item of d.items) {
        await query(`
          INSERT INTO withholding_tax_items (wht_id, pay_date, income_amount, tax_amount, description, pnd_form, income_type)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [req.params.id, item.pay_date, item.income_amount, item.tax_amount, item.description || '', item.pnd_form || '', item.income_type || '']);
      }
    }
    
    const updated = await query('SELECT * FROM withholding_tax WHERE id = $1', [req.params.id]);
    const updatedItems = await query('SELECT * FROM withholding_tax_items WHERE wht_id = $1 ORDER BY id', [req.params.id]);
    res.json({ ...updated.rows[0], items: updatedItems.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ISSUE (draft → issued) ───
router.post('/:id/issue', authenticate, async (req, res) => {
  try {
    const result = await query(`
      UPDATE withholding_tax SET status = 'issued', issue_date = COALESCE(issue_date, CURRENT_DATE), updated_at = NOW()
      WHERE id = $1 AND status = 'draft' RETURNING *
    `, [req.params.id]);
    if (!result.rows.length) return res.status(400).json({ error: 'ไม่สามารถออกเอกสารได้' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE (draft only) ───
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await query('DELETE FROM withholding_tax WHERE id = $1 AND status = $2 RETURNING id', [req.params.id, 'draft']);
    if (!result.rows.length) return res.status(400).json({ error: 'ลบได้เฉพาะเอกสาร draft' });
    res.json({ message: 'ลบสำเร็จ' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GENERATE PDF ───
router.get('/:id/pdf', authenticate, async (req, res) => {
  try {
    const wht = await query('SELECT * FROM withholding_tax WHERE id = $1', [req.params.id]);
    if (!wht.rows.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    const items = await query('SELECT * FROM withholding_tax_items WHERE wht_id = $1 ORDER BY id', [req.params.id]);
    
    const doc = wht.rows[0];
    const pdfData = {
      doc_no: doc.doc_no,
      book_no: doc.book_no || '',
      copy_no: doc.copy_no || 1,
      issue_date: doc.issue_date ? new Date(doc.issue_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : '',
      payer_name: doc.payer_name,
      payer_tax_id: doc.payer_tax_id,
      payer_address: doc.payer_address || '',
      payee_name: doc.payee_name,
      payee_tax_id: doc.payee_tax_id,
      payee_address: doc.payee_address || '',
      pnd_form: doc.pnd_form || '',
      pnd_seq: doc.pnd_seq || 1,
      income_type: doc.income_type || '',
      total_income: parseFloat(doc.total_income) || 0,
      total_tax: parseFloat(doc.total_tax) || 0,
      tax_words: doc.tax_words || '',
      fund_gpf: parseFloat(doc.fund_gpf) || 0,
      fund_sso: parseFloat(doc.fund_sso) || 0,
      fund_pvf: parseFloat(doc.fund_pvf) || 0,
      withhold_method: doc.withhold_method || 1,
      items: items.rows.map(i => ({
        pay_date: i.pay_date || '',
        description: i.description || '',
        income_amount: parseFloat(i.income_amount) || 0,
        tax_amount: parseFloat(i.tax_amount) || 0,
        pnd_form: i.pnd_form || '',
        income_type: i.income_type || '',
      }))
    };
    
    const tmpFile = path.join(os.tmpdir(), `wht_${doc.doc_no}_${Date.now()}.pdf`);
    const scriptPath = path.join(__dirname, '..', 'utils', 'generate_50twi.py');
    
    const tmpJson = tmpFile + '.json';
    fs.writeFileSync(tmpJson, JSON.stringify(pdfData));
    execSync(`cat "${tmpJson}" | python3 "${scriptPath}" "${tmpFile}"`);
    fs.unlinkSync(tmpJson);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="WHT_${doc.doc_no}.pdf"`);
    const stream = fs.createReadStream(tmpFile);
    stream.pipe(res);
    stream.on('end', () => fs.unlink(tmpFile, () => {}));
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: 'ไม่สามารถสร้าง PDF ได้: ' + err.message });
  }
});

module.exports = router;
