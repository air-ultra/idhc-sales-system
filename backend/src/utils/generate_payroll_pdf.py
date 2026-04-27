#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate Payroll Report PDF — รายงานเงินเดือน/ค่าจ้าง
Reads JSON from stdin, writes PDF to argv[1].
Uses WeasyPrint (Pango+HarfBuzz) for proper Thai text shaping.
"""
import sys
import json
import os
import html as html_lib
import calendar
from weasyprint import HTML
from weasyprint.text.fonts import FontConfiguration


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(BASE_DIR, '..', 'fonts')
FONT_REG = os.path.join(FONT_DIR, 'Sarabun-Regular.ttf')
FONT_BOLD = os.path.join(FONT_DIR, 'Sarabun-Bold.ttf')


def fmt_money(n):
    if n is None or n == '':
        return '-'
    try:
        v = float(n)
        if v == 0:
            return '-'
        return f"{v:,.2f}"
    except Exception:
        return '-'


def esc(text):
    if text is None:
        return ''
    return html_lib.escape(str(text))


def th_month_short(m):
    months = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
              'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    return months[m] if 1 <= m <= 12 else ''


def days_in_month(year, month):
    ce = year - 543 if year > 2500 else year
    return calendar.monthrange(ce, month)[1]


# ─── Read data ───
data = json.loads(sys.stdin.read())
out_path = sys.argv[1]

company_name = data.get('company_name', '')
year = int(data.get('year'))
month = int(data.get('month'))
report_date = data.get('report_date', '')
pay_date = data.get('pay_date', '')
items = data.get('items', [])

period_str = f"1 {th_month_short(month)} {year} - {days_in_month(year, month)} {th_month_short(month)} {year}"

# Group by employee_type (รองรับ monthly / contract / daily)
groups = {'monthly': [], 'contract': [], 'daily': []}
for it in items:
    t = (it.get('employee_type') or 'monthly').lower()
    if t not in groups:
        t = 'monthly'  # fallback for unknown types
    groups[t].append(it)

# Build rows
rows_html = ''
running_idx = 0
totals_all = {'salary': 0, 'other': 0, 'total': 0, 'ss': 0, 'wht': 0, 'net': 0}
group_order = [
    ('monthly',  'รายเดือน'),
    ('contract', 'รายสัญญาจ้าง'),
    ('daily',    'รายวัน'),
]
first_group = True

for gkey, glabel in group_order:
    rows = groups.get(gkey, [])
    if not rows:
        continue
    if not first_group:
        rows_html += '<tr class="spacer"><td colspan="10">&nbsp;</td></tr>'
    first_group = False

    # Group label header row
    rows_html += f'''
    <tr class="group-label">
      <td colspan="10">{esc(glabel)}</td>
    </tr>
    '''

    sums = {'salary': 0, 'other': 0, 'total': 0, 'ss': 0, 'wht': 0, 'net': 0}
    for it in rows:
        running_idx += 1
        salary = float(it.get('salary') or 0)
        other = float(it.get('other_income') or 0) + float(it.get('overtime') or 0) + float(it.get('bonus') or 0)
        total = salary + other
        ss = float(it.get('social_security') or 0)
        wht = float(it.get('withholding_tax') or 0)
        deduction = float(it.get('other_deduction') or 0)
        net = total - ss - wht - deduction

        sums['salary'] += salary
        sums['other'] += other
        sums['total'] += total
        sums['ss'] += ss
        sums['wht'] += wht
        sums['net'] += net

        name = esc(it.get('name', ''))
        idcard = esc(it.get('id_card_number', '') or '')
        name_cell = f'{name}<br><span class="idcard">{idcard}</span>' if idcard else name

        rows_html += f'''
        <tr>
          <td class="c">{running_idx}</td>
          <td class="c">{esc(it.get('employee_code', ''))}</td>
          <td>{name_cell}</td>
          <td class="r">{fmt_money(salary)}</td>
          <td class="r">{fmt_money(other)}</td>
          <td class="r">{fmt_money(total)}</td>
          <td class="r">{fmt_money(ss)}</td>
          <td class="r">{fmt_money(wht)}</td>
          <td class="r">{fmt_money(net)}</td>
          <td class="c">{esc(pay_date)}</td>
        </tr>
        '''

    # Subtotal row
    rows_html += f'''
    <tr class="subtotal">
      <td colspan="3"></td>
      <td class="r">{fmt_money(sums['salary'])}</td>
      <td class="r">{fmt_money(sums['other'])}</td>
      <td class="r">{fmt_money(sums['total'])}</td>
      <td class="r">{fmt_money(sums['ss'])}</td>
      <td class="r">{fmt_money(sums['wht'])}</td>
      <td class="r">{fmt_money(sums['net'])}</td>
      <td></td>
    </tr>
    '''
    for k in totals_all:
        totals_all[k] += sums[k]

ss_remit = totals_all['ss'] * 2  # ลูกจ้าง + นายจ้าง
wht_remit = totals_all['wht']
loan_remit = 0

html_content = f'''<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<style>
@font-face {{
  font-family: 'Sarabun';
  src: url('file://{FONT_REG}');
  font-weight: normal;
}}
@font-face {{
  font-family: 'Sarabun';
  src: url('file://{FONT_BOLD}');
  font-weight: bold;
}}

@page {{
  size: A4 landscape;
  margin: 10mm 12mm;
}}

* {{ box-sizing: border-box; margin: 0; padding: 0; }}

body {{
  font-family: 'Sarabun', sans-serif;
  font-size: 10pt;
  color: #000;
  line-height: 1.35;
}}

.header {{
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 3mm;
}}
.company {{
  font-size: 14pt;
  font-weight: bold;
}}
.report-title {{
  font-size: 12pt;
  font-weight: bold;
  margin-top: 1mm;
}}
.meta {{
  font-size: 10pt;
  text-align: right;
  line-height: 1.5;
}}
.meta-row {{
  display: flex;
  justify-content: flex-end;
  gap: 6mm;
}}
.meta-label {{ color: #555; }}

table.report {{
  width: 100%;
  border-collapse: collapse;
  margin-top: 3mm;
  font-size: 10pt;
}}
table.report thead tr {{
  background: #23AEE7;
  color: white;
}}
table.report th {{
  padding: 2mm 1.5mm;
  font-weight: bold;
  font-size: 10pt;
  text-align: center;
  border: 0.3pt solid #888;
  line-height: 1.25;
}}
table.report td {{
  padding: 1.5mm 1.5mm;
  border: 0.3pt solid #aaa;
  vertical-align: middle;
  font-size: 10pt;
}}
table.report .c {{ text-align: center; }}
table.report .r {{ text-align: right; }}
table.report .idcard {{ color: #555; font-size: 9pt; }}

table.report tr.subtotal td {{
  background: #f0f0f0;
  font-weight: bold;
}}
table.report tr.spacer td {{
  border: none;
  height: 3mm;
  padding: 0;
}}
table.report tr.group-label td {{
  background: #e6f4fb;
  color: #1e3a5f;
  font-weight: bold;
  font-size: 10.5pt;
  padding: 1.8mm 2mm;
  border: 0.3pt solid #888;
  text-align: left;
}}

.summary {{
  margin-top: 6mm;
  font-size: 11pt;
}}
.summary-row {{
  display: flex;
  margin-bottom: 1.5mm;
}}
.summary-label {{
  width: 95mm;
  padding-left: 20mm;
  font-weight: bold;
}}
.summary-value {{
  width: 36mm;
  text-align: right;
  font-weight: bold;
}}

.note {{
  margin-top: 8mm;
  font-size: 9pt;
  color: #333;
  line-height: 1.4;
}}
.note .label {{ font-weight: bold; }}
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="company">{esc(company_name)}</div>
    <div class="report-title">รายงานเงินเดือน/ค่าจ้าง</div>
  </div>
  <div class="meta">
    <div class="meta-row"><span class="meta-label">หน้า</span><span>1</span></div>
    <div class="meta-row"><span class="meta-label">วันที่รายงาน</span><span>{esc(report_date)}</span></div>
    <div class="meta-row"><span class="meta-label">งวดที่รายงาน</span><span>{esc(period_str)}</span></div>
  </div>
</div>

<table class="report">
  <thead>
    <tr>
      <th style="width:7%">ลำดับที่</th>
      <th style="width:9%">รหัสพนักงาน</th>
      <th style="width:23%">ชื่อ-เลขบัตรประจำตัวประชาชน</th>
      <th style="width:10%">เงินเดือน/<br>ค่าจ้าง 40(1)</th>
      <th style="width:9%">เงินได้อื่นๆ<br>40(1)</th>
      <th style="width:9%">รวมเงินได้</th>
      <th style="width:8%">ประกันสังคม</th>
      <th style="width:10%">หัก ณ ที่จ่าย<br>40(1)</th>
      <th style="width:10%">ยอดจ่ายพนักงาน</th>
      <th style="width:9%">วันที่ชำระเงิน</th>
    </tr>
  </thead>
  <tbody>
    {rows_html}
  </tbody>
</table>

<div class="summary">
  <div class="summary-row">
    <div class="summary-label">สรุปประกันสังคมที่ต้องนำส่ง</div>
    <div class="summary-value">{fmt_money(ss_remit)}</div>
  </div>
  <div class="summary-row">
    <div class="summary-label">สรุปภาษีหัก ณ ที่จ่ายเงินเดือนที่ต้องนำส่ง</div>
    <div class="summary-value">{fmt_money(wht_remit)}</div>
  </div>
  <div class="summary-row">
    <div class="summary-label">สรุปเงินกู้ยืม กยศ./กรอ. ที่ต้องนำส่ง</div>
    <div class="summary-value">{fmt_money(loan_remit)}</div>
  </div>
</div>

<div class="note">
  <span class="label">หมายเหตุ:</span> เงินได้ตามมาตรา 40(1) ประกอบด้วย เงินเดือน/ค่าจ้าง, ค่าล่วงเวลา, ค่านายหน้า, โบนัส, Fringe Benefit, ค่าเบี้ยเลี้ยง/ค่าครองชีพ, ค่ารักษาพยาบาล, ค่าที่พักอาศัย, ค่าตอบแทนกรรมการ, สวัสดิการอื่น
</div>

</body>
</html>
'''

font_config = FontConfiguration()
HTML(string=html_content).write_pdf(out_path, font_config=font_config)
