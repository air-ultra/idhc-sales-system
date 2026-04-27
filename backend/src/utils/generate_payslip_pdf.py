#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate Pay Slips PDF — สลิปเงินเดือน 2 ใบ/หน้า A4 portrait
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


def num_to_thai(num):
    """Convert positive number to Thai text. Supports decimals (สตางค์)."""
    if num is None:
        num = 0
    txt_digits = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
    txt_pos = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน']

    def _read_int(n):
        n = int(n)
        if n == 0:
            return 'ศูนย์'
        s = str(n)
        out = ''
        if len(s) > 7:
            high = s[:-6]
            low = s[-6:]
            return _read_int(int(high)) + 'ล้าน' + (_read_int(int(low)) if int(low) > 0 else '')
        digits = list(s)
        L = len(digits)
        for i, d in enumerate(digits):
            d = int(d)
            pos = L - i - 1
            if d == 0:
                continue
            if pos == 0 and d == 1 and L > 1:
                out += 'เอ็ด'
            elif pos == 1 and d == 2:
                out += 'ยี่' + txt_pos[1]
            elif pos == 1 and d == 1:
                out += txt_pos[1]
            else:
                out += txt_digits[d] + txt_pos[pos]
        return out

    try:
        v = float(num)
    except Exception:
        return ''
    if v < 0:
        return 'ลบ' + num_to_thai(-v)
    baht_part = int(v)
    satang_part = round((v - baht_part) * 100)
    if satang_part == 100:
        baht_part += 1
        satang_part = 0
    baht_txt = _read_int(baht_part) + 'บาท'
    if satang_part == 0:
        return baht_txt + 'ถ้วน'
    return baht_txt + _read_int(satang_part) + 'สตางค์'


# ─── Read data ───
data = json.loads(sys.stdin.read())
out_path = sys.argv[1]

company_name = data.get('company_name', '')
year = int(data.get('year'))
month = int(data.get('month'))
pay_date = data.get('pay_date', '')
items = data.get('items', [])
period_str = f"งวดเดือน {th_month_full(month)} {year}"


def build_slip(item):
    salary = float(item.get('salary') or 0)
    overtime = float(item.get('overtime') or 0)
    bonus = float(item.get('bonus') or 0)
    other_income = float(item.get('other_income') or 0)
    total_income = salary + overtime + bonus + other_income

    ss = float(item.get('social_security') or 0)
    wht = float(item.get('withholding_tax') or 0)
    deduction = float(item.get('other_deduction') or 0)
    total_deduction = ss + wht + deduction
    net = total_income - total_deduction

    full_name = f"{item.get('title') or ''}{item.get('name') or ''}".strip()

    return f'''
    <div class="slip">
      <div class="slip-header">
        <div class="company-line">{esc(company_name)}</div>
        <div class="period-line">ใบจ่ายเงินเดือน — {esc(period_str)}</div>
      </div>

      <div class="info-block">
        <div class="info-row">
          <div class="info-cell"><span class="info-label">รหัสพนักงาน:</span><span class="info-value">{esc(item.get('employee_code', '-'))}</span></div>
          <div class="info-cell"><span class="info-label">เลขบัตรประชาชน:</span><span class="info-value">{esc(item.get('id_card_number', '-'))}</span></div>
        </div>
        <div class="info-row">
          <div class="info-cell"><span class="info-label">ชื่อ-สกุล:</span><span class="info-value">{esc(full_name) or '-'}</span></div>
          <div class="info-cell"><span class="info-label">วันที่จ่าย:</span><span class="info-value">{esc(pay_date)}</span></div>
        </div>
        <div class="info-row">
          <div class="info-cell"><span class="info-label">แผนก:</span><span class="info-value">{esc(item.get('department', '-')) or '-'}</span></div>
          <div class="info-cell"><span class="info-label">ตำแหน่ง:</span><span class="info-value">{esc(item.get('position', '-')) or '-'}</span></div>
        </div>
        <div class="info-row">
          <div class="info-cell"><span class="info-label">ธนาคาร:</span><span class="info-value">{esc(item.get('bank_name', '-')) or '-'}</span></div>
          <div class="info-cell"><span class="info-label">เลขที่บัญชี:</span><span class="info-value">{esc(item.get('bank_account_no', '-')) or '-'}</span></div>
        </div>
      </div>

      <table class="amounts">
        <thead>
          <tr>
            <th class="l">รายได้</th>
            <th class="r">จำนวนเงิน</th>
            <th class="l">รายการหัก</th>
            <th class="r">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>เงินเดือน</td><td class="r">{fmt_money(salary)}</td>
            <td>ประกันสังคม</td><td class="r">{fmt_money(ss)}</td>
          </tr>
          <tr>
            <td>ค่าล่วงเวลา (OT)</td><td class="r">{fmt_money(overtime)}</td>
            <td>ภาษีหัก ณ ที่จ่าย</td><td class="r">{fmt_money(wht)}</td>
          </tr>
          <tr>
            <td>โบนัส</td><td class="r">{fmt_money(bonus)}</td>
            <td>หักอื่นๆ</td><td class="r">{fmt_money(deduction)}</td>
          </tr>
          <tr>
            <td>รายได้อื่นๆ</td><td class="r">{fmt_money(other_income)}</td>
            <td></td><td></td>
          </tr>
          <tr class="subtotal">
            <td>รวมรายได้</td><td class="r">{fmt_money(total_income)}</td>
            <td>รวมรายการหัก</td><td class="r">{fmt_money(total_deduction)}</td>
          </tr>
        </tbody>
      </table>

      <div class="net-box">
        <div class="net-label">ยอดสุทธิที่ได้รับ</div>
        <div class="net-amount">
          <div class="net-num">{fmt_money(net)} บาท</div>
          <div class="net-words">({esc(num_to_thai(net))})</div>
        </div>
      </div>

      <div class="signatures">
        <div class="sig"><div class="sig-line"></div><div class="sig-label">ลงชื่อผู้รับเงิน</div></div>
        <div class="sig"><div class="sig-line"></div><div class="sig-label">ลงชื่อผู้จ่ายเงิน</div></div>
      </div>
    </div>
    '''


# Build pages — 2 slips per page
slips_per_page = 2
pages_html = ''
for i in range(0, len(items), slips_per_page):
    page_slips = items[i:i + slips_per_page]
    cut_line = '<div class="cut-line"></div>' if len(page_slips) == 2 else ''
    body = build_slip(page_slips[0])
    if len(page_slips) > 1:
        body += cut_line + build_slip(page_slips[1])
    page_break = '' if i + slips_per_page >= len(items) else '<div class="page-break"></div>'
    pages_html += f'<div class="page">{body}</div>{page_break}'

if not items:
    pages_html = '<div class="empty">ไม่มีรายการเงินเดือนสำหรับงวดนี้</div>'

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
  margin: 8mm 12mm;
}}

* {{ box-sizing: border-box; margin: 0; padding: 0; }}

body {{
  font-family: 'Sarabun', sans-serif;
  font-size: 10pt;
  color: #000;
  line-height: 1.35;
}}

.page-break {{ page-break-after: always; }}
.empty {{ text-align: center; padding-top: 100mm; font-size: 14pt; }}

.slip {{
  height: 137mm;  /* half of A4 (297-16 margins) ~ 140mm */
  padding: 2mm 0;
  display: flex;
  flex-direction: column;
}}

.cut-line {{
  border-top: 0.5pt dashed #999;
  margin: 2mm 0;
}}

/* ─── Header ─── */
.slip-header {{
  background: #23AEE7;
  color: white;
  padding: 2.5mm 4mm;
  border-radius: 1mm;
  display: flex;
  justify-content: space-between;
  align-items: center;
}}
.company-line {{
  font-size: 12pt;
  font-weight: bold;
}}
.period-line {{
  font-size: 10pt;
  font-weight: bold;
}}

/* ─── Info ─── */
.info-block {{
  margin: 3mm 1mm;
  font-size: 10pt;
  line-height: 1.5;
}}
.info-row {{
  display: flex;
  margin-bottom: 0.5mm;
}}
.info-cell {{
  width: 50%;
  display: flex;
}}
.info-label {{
  font-weight: bold;
  width: 28mm;
  flex-shrink: 0;
}}
.info-value {{
  flex: 1;
}}

/* ─── Amounts table ─── */
table.amounts {{
  width: 100%;
  border-collapse: collapse;
  font-size: 10pt;
  margin-bottom: 3mm;
}}
table.amounts thead tr {{
  background: #23AEE7;
  color: white;
}}
table.amounts th {{
  padding: 1.5mm 2mm;
  font-weight: bold;
  font-size: 10pt;
}}
table.amounts th.l {{ text-align: left; }}
table.amounts th.r {{ text-align: right; }}
table.amounts td {{
  padding: 1.2mm 2mm;
  border: 0.3pt solid #ccc;
  font-size: 10pt;
}}
table.amounts td.r {{ text-align: right; }}
table.amounts tr.subtotal td {{
  background: #f5f9fc;
  font-weight: bold;
}}

/* ─── Net box ─── */
.net-box {{
  background: #23AEE7;
  color: white;
  padding: 2.5mm 4mm;
  border-radius: 1mm;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4mm;
}}
.net-label {{
  font-size: 11pt;
  font-weight: bold;
}}
.net-amount {{ text-align: right; }}
.net-num {{
  font-size: 14pt;
  font-weight: bold;
}}
.net-words {{
  font-size: 9pt;
  margin-top: 0.5mm;
}}

/* ─── Signatures ─── */
.signatures {{
  display: flex;
  justify-content: space-around;
  margin-top: auto;
  padding-top: 4mm;
}}
.sig {{
  width: 48%;
  text-align: center;
}}
.sig-line {{
  border-bottom: 0.5pt solid #888;
  height: 8mm;
  margin: 0 8mm;
}}
.sig-label {{
  font-size: 9pt;
  color: #555;
  margin-top: 1mm;
}}
</style>
</head>
<body>
{pages_html}
</body>
</html>
'''

font_config = FontConfiguration()
HTML(string=html_content).write_pdf(out_path, font_config=font_config)
