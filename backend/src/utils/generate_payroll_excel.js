/**
 * Generate Payroll Report Excel (.xlsx)
 *
 * Layout matches sample template:
 *   - Company name + report meta (rows 1-3)
 *   - Header row (sky-blue fill #23AEE7, bold, centered)
 *   - Group by employee_type ('monthly' | 'daily')
 *     each group ends with SUM row
 *   - Empty divider row between groups
 *   - Footer: ปกส.นำส่ง / ภาษีนำส่ง / กยศ.
 *   - หมายเหตุ
 *
 * Uses exceljs. Returns a Buffer.
 */
const ExcelJS = require('exceljs');

const HEADER_FILL = 'FF23AEE7';
const SUBTOTAL_FILL = 'FFEFEFEF';

const COLUMNS = [
  { key: 'idx',         label: 'ลำดับที่',                      width: 8,  align: 'center' },
  { key: 'code',        label: 'รหัสพนักงาน',                   width: 12, align: 'center' },
  { key: 'name',        label: 'ชื่อ-เลขบัตรประจำตัวประชาชน',     width: 32, align: 'left' },
  { key: 'salary',      label: 'เงินเดือน/\nค่าจ้าง 40(1)',     width: 14, align: 'right', money: true },
  { key: 'other',       label: 'เงินได้อื่นๆ \n40(1)',          width: 13, align: 'right', money: true },
  { key: 'total',       label: 'รวมเงินได้',                    width: 13, align: 'right', money: true },
  { key: 'ss',          label: 'ประกันสังคม',                   width: 12, align: 'right', money: true },
  { key: 'wht',         label: 'หัก ณ ที่จ่าย   \n40(1)',       width: 14, align: 'right', money: true },
  { key: 'net',         label: 'ยอดจ่ายพนักงาน',                width: 14, align: 'right', money: true },
  { key: 'pay_date',    label: 'วันที่ชำระเงิน',                  width: 13, align: 'center' },
];

const TH_MONTHS_SHORT = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                          'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function daysInMonth(year, month) {
  // year may be BE; convert to CE for Date()
  const ce = year > 2500 ? year - 543 : year;
  return new Date(ce, month, 0).getDate();
}

async function generatePayrollExcel(data) {
  const { company_name, year, month, report_date, pay_date, items = [] } = data;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'IDHC Sales System';
  wb.created = new Date();

  const ws = wb.addWorksheet('PayrollReport', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  // ─── Set column widths ───
  COLUMNS.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width;
  });

  // ─── Header rows (1-3) ───
  ws.mergeCells('A1:G1');
  ws.getCell('A1').value = company_name;
  ws.getCell('A1').font = { name: 'Sarabun', size: 12, bold: true };
  ws.getCell('H1').value = 'หน้า';
  ws.getCell('H1').alignment = { horizontal: 'right' };
  ws.getCell('J1').value = 1;
  ws.getCell('J1').alignment = { horizontal: 'right' };

  ws.mergeCells('A2:G2');
  ws.getCell('A2').value = 'รายงานเงินเดือน/ค่าจ้าง';
  ws.getCell('A2').font = { name: 'Sarabun', size: 12, bold: true };
  ws.getCell('H2').value = 'วันที่รายงาน';
  ws.getCell('H2').alignment = { horizontal: 'right' };
  ws.getCell('J2').value = report_date;
  ws.getCell('J2').alignment = { horizontal: 'right' };

  ws.getCell('H3').value = 'งวดที่รายงาน';
  ws.getCell('H3').alignment = { horizontal: 'right' };
  const periodStr = `1 ${TH_MONTHS_SHORT[month]} ${year} - ${daysInMonth(year, month)} ${TH_MONTHS_SHORT[month]} ${year}`;
  ws.getCell('J3').value = periodStr;
  ws.getCell('J3').alignment = { horizontal: 'right' };

  // ─── Column headers (row 4, sky-blue fill) ───
  const headerRow = ws.getRow(4);
  COLUMNS.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.label;
    cell.font = { name: 'Sarabun', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    };
  });
  headerRow.height = 36;

  // ─── Body — group by employee_type (รองรับ monthly / contract / daily) ───
  const groups = { monthly: [], contract: [], daily: [] };
  items.forEach((it) => {
    const t = (it.employee_type || 'monthly').toLowerCase();
    (groups[t] || groups.monthly).push(it);
  });

  let currentRow = 5;
  let runningIdx = 0;
  let totalSS = 0;
  let totalWHT = 0;

  const writeDataRow = (rowIdx, idx, item) => {
    const salary = Number(item.salary) || 0;
    const other = (Number(item.other_income) || 0)
                + (Number(item.overtime) || 0)
                + (Number(item.bonus) || 0);
    const total = salary + other;
    const ss = Number(item.social_security) || 0;
    const wht = Number(item.withholding_tax) || 0;
    const deduction = Number(item.other_deduction) || 0;
    const net = total - ss - wht - deduction;

    const idCard = item.id_card_number || '';
    const nameCell = idCard ? `${item.name}  ${idCard}` : (item.name || '');

    const row = ws.getRow(rowIdx);
    const values = [idx, item.employee_code || '', nameCell, salary, other, total, ss, wht, net, item.pay_date || ''];
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      const col = COLUMNS[i];
      cell.font = { name: 'Sarabun', size: 11 };
      cell.alignment = { horizontal: col.align, vertical: 'middle', wrapText: i === 2 };
      if (col.money) {
        cell.numFmt = '#,##0.00;(#,##0.00);"-"';
      }
    });
    row.height = 18;
    return { ss, wht };
  };

  const writeSubtotalRow = (rowIdx, startRow, endRow) => {
    const row = ws.getRow(rowIdx);
    // Empty cells A,B,C
    for (let c = 1; c <= 3; c++) row.getCell(c).value = null;
    // SUM formulas for D-I (cols 4-9)
    const cols = ['D', 'E', 'F', 'G', 'H', 'I'];
    cols.forEach((cl, i) => {
      const cell = row.getCell(4 + i);
      cell.value = { formula: `SUM(${cl}${startRow}:${cl}${endRow})` };
      cell.numFmt = '#,##0.00;(#,##0.00);"-"';
      cell.font = { name: 'Sarabun', size: 11, bold: true };
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBTOTAL_FILL } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF999999' } },
        bottom: { style: 'thin', color: { argb: 'FF999999' } },
      };
    });
    row.height = 18;
  };

  const groupOrder = ['monthly', 'contract', 'daily'];
  const groupLabels = {
    monthly: 'รายเดือน',
    contract: 'รายสัญญาจ้าง',
    daily: 'รายวัน',
  };
  let isFirstGroup = true;
  for (const gkey of groupOrder) {
    const rows = groups[gkey];
    if (!rows || rows.length === 0) continue;

    if (!isFirstGroup) {
      currentRow += 1; // empty divider row
    }
    isFirstGroup = false;

    // Group label row (light blue background, bold)
    const labelRow = ws.getRow(currentRow);
    ws.mergeCells(`A${currentRow}:J${currentRow}`);
    const labelCell = labelRow.getCell(1);
    labelCell.value = groupLabels[gkey] || gkey;
    labelCell.font = { name: 'Sarabun', size: 11, bold: true, color: { argb: 'FF1E3A5F' } };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4FB' } };
    labelCell.alignment = { horizontal: 'left', vertical: 'middle' };
    labelCell.border = {
      top: { style: 'thin', color: { argb: 'FF888888' } },
      left: { style: 'thin', color: { argb: 'FF888888' } },
      bottom: { style: 'thin', color: { argb: 'FF888888' } },
      right: { style: 'thin', color: { argb: 'FF888888' } },
    };
    labelRow.height = 18;
    currentRow += 1;

    const groupStart = currentRow;
    for (const item of rows) {
      runningIdx += 1;
      const sums = writeDataRow(currentRow, runningIdx, { ...item, pay_date });
      totalSS += sums.ss;
      totalWHT += sums.wht;
      currentRow += 1;
    }
    const groupEnd = currentRow - 1;
    writeSubtotalRow(currentRow, groupStart, groupEnd);
    currentRow += 1;
  }

  // ─── Summary footer ───
  currentRow += 1;
  const setSummary = (label, value) => {
    ws.getCell(`B${currentRow}`).value = label;
    ws.getCell(`B${currentRow}`).font = { name: 'Sarabun', size: 11 };
    ws.getCell(`D${currentRow}`).value = value;
    ws.getCell(`D${currentRow}`).numFmt = '#,##0.00;(#,##0.00);"-"';
    ws.getCell(`D${currentRow}`).font = { name: 'Sarabun', size: 11, bold: true };
    ws.getCell(`D${currentRow}`).alignment = { horizontal: 'right' };
    currentRow += 1;
  };
  setSummary('สรุปประกันสังคมที่ต้องนำส่ง', totalSS * 2);  // ลูกจ้าง + นายจ้าง
  setSummary('สรุปภาษีหัก ณ ที่จ่ายเงินเดือนที่ต้องนำส่ง', totalWHT);
  setSummary('สรุปเงินกู้ยืม กยศ./กรอ. ที่ต้องนำส่ง', 0);

  // ─── Notes ───
  currentRow += 1;
  ws.getCell(`A${currentRow}`).value = 'หมายเหตุ:';
  ws.getCell(`A${currentRow}`).font = { name: 'Sarabun', size: 9, bold: true };
  ws.mergeCells(`B${currentRow}:J${currentRow}`);
  ws.getCell(`B${currentRow}`).value = 'เงินได้ตามมาตรา 40(1) ประกอบด้วย เงินเดือน/ค่าจ้าง, ค่าล่วงเวลา, ค่านายหน้า, โบนัส, Fringe Benefit, ค่าเบี้ยเลี้ยง/ค่าครองชีพ, ค่ารักษาพยาบาล, ค่าที่พักอาศัย, ค่าตอบแทนกรรมการ, สวัสดิการอื่น';
  ws.getCell(`B${currentRow}`).font = { name: 'Sarabun', size: 9 };
  ws.getCell(`B${currentRow}`).alignment = { wrapText: true, vertical: 'top' };

  return wb.xlsx.writeBuffer();
}

module.exports = { generatePayrollExcel };
