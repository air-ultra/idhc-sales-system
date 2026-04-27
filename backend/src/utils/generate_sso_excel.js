/**
 * Generate SSO Form 1-10 Excel (e-Filing format)
 *
 * Strict format required by SSO e-Filing system:
 *   - Sheet name: '000000' (literal, per sample)
 *   - 6 columns starting at row 1 (no title/header decoration):
 *       A: เลขบัตรประชาชน  (numFmt '0000000000000', stored as int)
 *       B: คำนำหน้า         (string)
 *       C: ชื่อ              (string)
 *       D: สกุล              (string)
 *       E: ค่าจ้าง           (numFmt '0.00')
 *       F: เงินสมทบ          (numFmt '0.00')
 *   - No total row, no formatting beyond what e-Filing accepts
 *
 * Returns Buffer.
 */
const ExcelJS = require('exceljs');

const COL_HEADERS = ['เลขบัตรประชาชน', 'คำนำหน้า', 'ชื่อ', 'สกุล', 'ค่าจ้าง', 'เงินสมทบ'];

// Column widths from sample (in Excel character units)
const COL_WIDTHS = [17.14, 14.41, 20.28, 19.28, 13.85, 12.56];

/**
 * Split Thai full name into ชื่อ / สกุล if not already separated.
 * Caller may pass first_name / last_name directly; we honor those if present.
 */
function splitName(item) {
  if (item.first_name || item.last_name) {
    return [item.first_name || '', item.last_name || ''];
  }
  const full = (item.name || '').trim();
  if (!full) return ['', ''];
  const parts = full.split(/\s+/);
  if (parts.length === 1) return [parts[0], ''];
  return [parts[0], parts.slice(1).join(' ')];
}

async function generateSSOExcel(data) {
  const { items = [] } = data;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'IDHC Sales System';
  wb.created = new Date();

  // Sheet name MUST be literal '000000' per e-Filing spec
  const ws = wb.addWorksheet('000000');

  // Set column widths
  COL_WIDTHS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  // Row 1: column headers (no special styling — keep e-Filing-compatible)
  COL_HEADERS.forEach((label, i) => {
    ws.getCell(1, i + 1).value = label;
  });

  // Data rows
  items.forEach((item, idx) => {
    const r = idx + 2;
    const [firstName, lastName] = splitName(item);

    // เลขบัตรประชาชน — store as integer with format '0000000000000'
    const idCardRaw = String(item.id_card_number || '').replace(/\D/g, '');
    const idCardCell = ws.getCell(r, 1);
    if (idCardRaw) {
      idCardCell.value = Number(idCardRaw);
      idCardCell.numFmt = '0000000000000';
    } else {
      idCardCell.value = '';
    }

    // คำนำหน้า / ชื่อ / สกุล
    ws.getCell(r, 2).value = item.title || '';
    ws.getCell(r, 3).value = firstName;
    ws.getCell(r, 4).value = lastName;

    // ค่าจ้าง
    const wageCell = ws.getCell(r, 5);
    wageCell.value = Number(item.salary) || 0;
    wageCell.numFmt = '0.00';

    // เงินสมทบ
    const contribCell = ws.getCell(r, 6);
    contribCell.value = Number(item.contribution) || 0;
    contribCell.numFmt = '0.00';
  });

  return wb.xlsx.writeBuffer();
}

module.exports = { generateSSOExcel };
