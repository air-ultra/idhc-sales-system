#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate SSO Form 1-10 PDF — แบบรายการแสดงการส่งเงินสมทบ
Reads JSON from stdin, writes PDF to argv[1].
Uses WeasyPrint for proper Thai text shaping.
"""
import sys
import json
import os
import html as html_lib
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


def th_month_full(m):
    months = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
              'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
    return months[m] if 1 <= m <= 12 else ''


# ─── Read data ───
data = json.loads(sys.stdin.read())
out_path = sys.argv[1]

company_name = data.get('company_name', '')
year = int(data.get('year'))
month = int(data.get('month'))
report_date = data.get('report_date', '')
employer_account_no = data.get('employer_account_no', '') or '............................................'
items = data.get('items', [])
period_str = f"{th_month_full(month)} {year}"

# Filter — only insured employees (caller already filters, but be safe)
items = [it for it in items if (float(it.get('contribution') or 0) > 0
                                 or (it.get('insured') is True))]

# Build rows
rows_html = ''
grand_salary = 0
grand_contrib = 0
for idx, it in enumerate(items, start=1):
    full_name = f"{it.get('title') or ''}{it.get('name') or ''}".strip()
    salary = float(it.get('salary') or 0)
    contrib = float(it.get('contribution') or 0)
    grand_salary += salary
    grand_contrib += contrib
    rows_html += f'''
    <tr>
      <td class="c">{idx}</td>
      <td class="c">{esc(it.get('id_card_number', '-')) or '-'}</td>
      <td>{esc(full_name) or '-'}</td>
      <td class="r">{fmt_money(salary)}</td>
      <td class="r">{fmt_money(contrib)}</td>
    </tr>
    '''

employee_share = grand_contrib
employer_share = grand_contrib
total_remit = employee_share + employer_share

if not items:
    body_content = '<div class="empty">ไม่มีรายการผู้ประกันตนสำหรับงวดนี้</div>'
else:
    body_content = f'''
    <table class="report">
      <thead>
        <tr>
          <th style="width:8%">ลำดับ</th>
          <th style="width:22%">เลขประจำตัวประชาชน</th>
          <th style="width:38%">ชื่อ - สกุล (ผู้ประกันตน)</th>
          <th style="width:16%">ค่าจ้าง (บาท)</th>
          <th style="width:16%">เงินสมทบ (บาท)</th>
        </tr>
      </thead>
      <tbody>
        {rows_html}
        <tr class="grand">
          <td colspan="3" class="r">รวมทั้งสิ้น</td>
          <td class="r">{fmt_money(grand_salary)}</td>
          <td class="r">{fmt_money(grand_contrib)}</td>
        </tr>
      </tbody>
    </table>

    <div class="summary">
      <div class="summary-title">สรุปยอดเงินสมทบที่ต้องนำส่ง</div>
      <div class="summary-grid">
        <div class="sum-row"><div class="sum-label">จำนวนผู้ประกันตน</div><div class="sum-value">{len(items):,}</div><div class="sum-unit">คน</div></div>
        <div class="sum-row"><div class="sum-label">รวมค่าจ้างที่ใช้คำนวณ</div><div class="sum-value">{fmt_money(grand_salary)}</div><div class="sum-unit">บาท</div></div>
        <div class="sum-row"><div class="sum-label">เงินสมทบส่วนของลูกจ้าง</div><div class="sum-value">{fmt_money(employee_share)}</div><div class="sum-unit">บาท</div></div>
        <div class="sum-row"><div class="sum-label">เงินสมทบส่วนของนายจ้าง</div><div class="sum-value">{fmt_money(employer_share)}</div><div class="sum-unit">บาท</div></div>
        <div class="sum-row total"><div class="sum-label">รวมเงินสมทบที่นำส่งทั้งสิ้น</div><div class="sum-value">{fmt_money(total_remit)}</div><div class="sum-unit">บาท</div></div>
      </div>
    </div>

    <div class="signatures">
      <div class="sig">
        <div class="sig-line"></div>
        <div class="sig-label">ลงชื่อผู้จัดทำ</div>
        <div class="sig-date">วันที่ {esc(report_date)}</div>
      </div>
      <div class="sig">
        <div class="sig-line"></div>
        <div class="sig-label">ลงชื่อนายจ้าง / ผู้มีอำนาจ</div>
        <div class="sig-date">วันที่ {esc(report_date)}</div>
      </div>
    </div>
    '''

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
  size: A4;
  margin: 14mm 14mm;
  @bottom-right {{
    content: "หน้า " counter(page) " / " counter(pages);
    font-family: 'Sarabun', sans-serif;
    font-size: 10pt;
    color: #555;
  }}
}}

* {{ box-sizing: border-box; margin: 0; padding: 0; }}

body {{
  font-family: 'Sarabun', sans-serif;
  font-size: 11pt;
  color: #000;
  line-height: 1.4;
}}

.title-block {{
  text-align: center;
  margin-bottom: 5mm;
}}
.title-main {{
  font-size: 16pt;
  font-weight: bold;
}}
.title-sub {{
  font-size: 13pt;
  font-weight: bold;
  margin-top: 1mm;
}}

.meta {{
  margin-bottom: 4mm;
  font-size: 11pt;
}}
.meta-row {{
  display: flex;
  margin-bottom: 1mm;
}}
.meta-label {{
  width: 38mm;
  font-weight: normal;
}}
.meta-value {{
  flex: 1;
  font-weight: bold;
}}

table.report {{
  width: 100%;
  border-collapse: collapse;
  font-size: 11pt;
  margin-bottom: 4mm;
}}
table.report thead tr {{
  background: #23AEE7;
  color: white;
}}
table.report th {{
  padding: 2mm 2mm;
  font-weight: bold;
  text-align: center;
  border: 0.3pt solid #888;
  font-size: 11pt;
}}
table.report td {{
  padding: 1.5mm 2mm;
  border: 0.3pt solid #aaa;
  font-size: 11pt;
}}
table.report .c {{ text-align: center; }}
table.report .r {{ text-align: right; }}
table.report tr.grand td {{
  background: #f0f0f0;
  font-weight: bold;
}}

.summary {{
  margin-top: 5mm;
}}
.summary-title {{
  font-size: 12pt;
  font-weight: bold;
  margin-bottom: 2mm;
}}
.summary-grid {{
  font-size: 11pt;
}}
.sum-row {{
  display: flex;
  margin-bottom: 1.5mm;
  padding-left: 6mm;
}}
.sum-label {{
  width: 80mm;
}}
.sum-value {{
  width: 30mm;
  text-align: right;
  font-weight: bold;
}}
.sum-unit {{
  padding-left: 2mm;
  color: #555;
}}
.sum-row.total .sum-value {{
  border-top: 0.5pt solid #000;
  padding-top: 0.5mm;
}}

.signatures {{
  display: flex;
  justify-content: space-around;
  margin-top: 18mm;
}}
.sig {{
  width: 40%;
  text-align: center;
}}
.sig-line {{
  border-bottom: 0.5pt solid #888;
  height: 8mm;
  margin: 0 8mm;
}}
.sig-label {{
  font-size: 10pt;
  margin-top: 1.5mm;
  font-weight: bold;
}}
.sig-date {{
  font-size: 9pt;
  color: #555;
  margin-top: 0.5mm;
}}

.empty {{ text-align: center; padding-top: 80mm; font-size: 14pt; }}
</style>
</head>
<body>

<div class="title-block">
  <div class="title-main">แบบรายการแสดงการส่งเงินสมทบ</div>
  <div class="title-sub">(สปส. 1-10)</div>
</div>

<div class="meta">
  <div class="meta-row"><div class="meta-label">ชื่อสถานประกอบการ:</div><div class="meta-value">{esc(company_name)}</div></div>
  <div class="meta-row"><div class="meta-label">เลขที่บัญชีนายจ้าง:</div><div class="meta-value">{esc(employer_account_no)}</div></div>
  <div class="meta-row"><div class="meta-label">ประจำงวดเดือน:</div><div class="meta-value">{esc(period_str)}</div></div>
  <div class="meta-row"><div class="meta-label">วันที่ออกรายงาน:</div><div class="meta-value">{esc(report_date)}</div></div>
</div>

{body_content}

</body>
</html>
'''

font_config = FontConfiguration()
HTML(string=html_content).write_pdf(out_path, font_config=font_config)
