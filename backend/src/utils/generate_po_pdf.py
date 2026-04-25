#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate Purchase Order PDF — IDEA HOUSE template (compact professional layout)
Reads JSON from stdin, writes PDF to argv[1].
Uses WeasyPrint (Pango+HarfBuzz) for proper Thai text shaping.
"""
import sys
import json
import os
import html as html_lib
from weasyprint import HTML
from weasyprint.text.fonts import FontConfiguration


# ─── Paths ───
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(BASE_DIR, '..', 'fonts')
ASSETS_DIR = os.path.join(BASE_DIR, '..', 'assets')

FONT_REG = os.path.join(FONT_DIR, 'Sarabun-Regular.ttf')
FONT_BOLD = os.path.join(FONT_DIR, 'Sarabun-Bold.ttf')
LOGO_PATH = os.path.join(ASSETS_DIR, 'logo.png')


def fmt_money(n):
    try:
        return f"{float(n):,.2f}"
    except Exception:
        return "0.00"


def fmt_qty(n):
    try:
        v = float(n)
        if v == int(v):
            return f"{int(v):,}"
        return f"{v:,.2f}"
    except Exception:
        return "0"


def safe(value, default=''):
    if value is None or str(value).strip() == '':
        return default
    return str(value)


def esc(text):
    if text is None:
        return ''
    return html_lib.escape(str(text)).replace('\n', '<br>')


# ─── Read data ───
data = json.loads(sys.stdin.read())
out_path = sys.argv[1]

# ─── Build items rows ───
items_html = ''
for item in data.get('items', []):
    desc = esc(item.get('description', ''))
    items_html += f'''
    <tr>
      <td class="col-no">{esc(item.get('no', ''))}</td>
      <td class="col-desc">{desc}</td>
      <td class="col-qty">{fmt_qty(item.get('quantity', 0))}</td>
      <td class="col-price">{fmt_money(item.get('unit_price', 0))}</td>
      <td class="col-total">{fmt_money(item.get('total', 0))}</td>
    </tr>
    '''

# ─── Build meta rows (PO info on the right) ───
meta_rows = [
    ('เลขที่', data.get('po_number')),
    ('วันที่', data.get('po_date')),
    ('เครดิต', f"{data.get('credit_days', 0)} วัน"),
    ('ครบกำหนด', data.get('due_date')),
    ('ผู้สั่งซื้อ', data.get('ordered_by')),
]
if data.get('job_name'):
    meta_rows.append(('ชื่องาน', data.get('job_name')))
if data.get('wht_rate') and float(data.get('wht_rate', 0)) > 0:
    meta_rows.append(('หัก ณ ที่จ่าย', f"{data.get('wht_rate')}%"))

meta_html = ''
for label, value in meta_rows:
    val = safe(value, '-')
    meta_html += f'''
    <div class="meta-row">
      <div class="meta-label">{esc(label)}</div>
      <div class="meta-value">{esc(val)}</div>
    </div>
    '''

# ─── Build totals (WHT optional) ───
wht_html = ''
if data.get('show_wht'):
    wht_html = f'''
    <hr class="total-divider">
    <div class="total-row">
      <div class="total-label">หักภาษี ณ ที่จ่าย {data.get('wht_rate', 0)}%</div>
      <div class="total-value">{fmt_money(data.get('wht_amount', 0))}</div>
      <div class="total-unit">บาท</div>
    </div>
    <div class="total-row">
      <div class="total-label">ยอดชำระ</div>
      <div class="total-value pink bold">{fmt_money(data.get('net_payment', 0))}</div>
      <div class="total-unit">บาท</div>
    </div>
    '''

# ─── Logo block ───
if os.path.exists(LOGO_PATH):
    logo_html = f'<img src="file://{LOGO_PATH}" class="logo">'
else:
    logo_html = '<div class="logo-text"><div class="logo-main">IDEA HOUSE</div><div class="logo-sub">C E N T E R</div></div>'

# ─── Compose HTML ───
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
  margin: 12mm 14mm;
}}

* {{
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}}

body {{
  font-family: 'Sarabun', sans-serif;
  font-size: 9pt;
  color: #000;
  line-height: 1.35;
}}

.pink {{ color: #c41556; }}
.bold {{ font-weight: bold; }}
.gray {{ color: #737373; }}

/* ─── HEADER ─── */
.header {{
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2mm;
}}
.logo {{ width: 38mm; height: auto; }}
.logo-text .logo-main {{
  font-size: 14pt; font-weight: bold; color: #c41556;
}}
.logo-text .logo-sub {{
  font-size: 8pt; color: #737373; letter-spacing: 2px;
}}
.title {{
  font-size: 20pt; font-weight: bold; color: #c41556;
  text-align: right;
  line-height: 1;
}}

/* ─── INFO ROW (payer left, meta right) ─── */
.info-row {{
  display: flex;
  justify-content: space-between;
  margin-top: 1mm;
}}
.payer {{
  width: 110mm;
  padding-right: 4mm;
  font-size: 9pt;
  line-height: 1.4;
}}
.payer-name {{ font-weight: bold; font-size: 9.5pt; margin-bottom: 0.5mm; }}

.meta {{
  width: 70mm;
  font-size: 9pt;
  border-top: 0.5pt solid #d9d9d9;
  padding-top: 1mm;
}}
.meta-row {{
  display: flex;
  margin-bottom: 1mm;
}}
.meta-label {{
  width: 26mm;
  color: #737373;
}}
.meta-value {{
  flex: 1;
}}

/* ─── SUPPLIER ─── */
.supplier {{
  margin-top: 3mm;
  font-size: 9pt;
  line-height: 1.4;
}}
.supplier-header {{
  font-weight: bold;
  color: #c41556;
  font-size: 9.5pt;
  margin-bottom: 0.5mm;
}}
.supplier-name {{ font-weight: bold; font-size: 9.5pt; }}

/* ─── ITEMS TABLE ─── */
.items {{
  width: 100%;
  border-collapse: collapse;
  margin-top: 5mm;
  font-size: 9pt;
}}
.items thead tr {{
  background: #c41556;
  color: white;
}}
.items th {{
  padding: 1.5mm 2mm;
  text-align: left;
  font-weight: bold;
  font-size: 9pt;
}}
.items td {{
  padding: 1.5mm 2mm;
  vertical-align: top;
}}
.items .col-no {{ width: 8mm; text-align: center; }}
.items .col-desc {{ }}
.items .col-qty {{ width: 16mm; text-align: right; }}
.items .col-price {{ width: 28mm; text-align: right; white-space: nowrap; }}
.items .col-total {{ width: 26mm; text-align: right; }}
.items th.col-qty, .items th.col-price, .items th.col-total {{
  text-align: right;
}}
.items th.col-no {{ text-align: center; }}
.items tbody tr {{ border-bottom: 0.3pt solid #e5e5e5; }}

/* ─── TOTALS ─── */
.totals-section {{
  display: flex;
  justify-content: space-between;
  margin-top: 3mm;
  font-size: 9pt;
}}
.words {{
  flex: 1;
  font-weight: bold;
  padding-top: 1mm;
  padding-right: 5mm;
}}
.totals {{
  width: 75mm;
}}
.total-row {{
  display: flex;
  justify-content: flex-end;
  padding: 0.6mm 0;
}}
.total-label {{
  flex: 1;
  text-align: right;
  color: #737373;
  padding-right: 4mm;
}}
.total-value {{
  width: 24mm;
  text-align: right;
}}
.total-unit {{
  width: 9mm;
  text-align: left;
  color: #737373;
  padding-left: 1mm;
}}
.total-divider {{
  border: none;
  border-top: 0.5pt solid #d9d9d9;
  margin: 1.5mm 0 1mm 0;
}}

/* ─── SIGNATURES (เหมือนตัวอย่างที่พี่ส่งมา — แต่ละฝั่งมี 2 ช่อง) ─── */
.signatures {{
  position: fixed;
  bottom: 12mm;
  left: 14mm;
  right: 14mm;
}}
.sig-names {{
  display: flex;
  justify-content: flex-start;
  font-weight: bold;
  font-size: 9pt;
  margin-bottom: 14mm;
}}
.sig-names .right {{ width: 88mm; text-align: left; }}
.sig-lines {{
  display: flex;
  justify-content: flex-start;
}}
.sig-block {{
  display: flex;
  width: 88mm;
  justify-content: space-between;
}}
.sig-line {{
  width: 40mm;
  text-align: center;
  font-size: 8.5pt;
  color: #737373;
  padding-top: 8mm;
  position: relative;
}}
.sig-line::before {{
  content: "";
  position: absolute;
  top: 6mm;
  left: 4mm;
  right: 4mm;
  border-top: 0.5pt solid #b3b3b3;
}}
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div>{logo_html}</div>
  <div class="title">ใบสั่งซื้อ</div>
</div>

<!-- INFO (payer + meta) -->
<div class="info-row">
  <div class="payer">
    <div class="payer-name">{esc(data.get('payer_name', ''))}</div>
    <div>{esc(data.get('payer_address', ''))}</div>
    <div>เลขประจำตัวผู้เสียภาษี {esc(data.get('payer_tax_id', ''))}</div>
    <div>โทร. {esc(data.get('payer_phone', ''))}</div>
    <div>เบอร์มือถือ {esc(data.get('payer_mobile', ''))}</div>
    <div>โทรสาร {esc(data.get('payer_fax', ''))}</div>
    <div>{esc(data.get('payer_website', ''))}</div>
  </div>
  <div class="meta">
    {meta_html}
  </div>
</div>

<!-- SUPPLIER -->
<div class="supplier">
  <div class="supplier-header">ผู้จำหน่าย</div>
  <div class="supplier-name">{esc(data.get('supplier_name', ''))}</div>
  <div>{esc(data.get('supplier_address', ''))}</div>
  {f'<div>เลขประจำตัวผู้เสียภาษี {esc(data.get("supplier_tax_id"))}</div>' if data.get('supplier_tax_id') else ''}
</div>

<!-- ITEMS TABLE -->
<table class="items">
  <thead>
    <tr>
      <th class="col-no">#</th>
      <th class="col-desc">รายละเอียด</th>
      <th class="col-qty">จำนวน</th>
      <th class="col-price">ราคาต่อหน่วย</th>
      <th class="col-total">ยอดรวม</th>
    </tr>
  </thead>
  <tbody>
    {items_html}
  </tbody>
</table>

<!-- TOTALS -->
<div class="totals-section">
  <div class="words">({esc(data.get('grand_total_words', ''))})</div>
  <div class="totals">
    <div class="total-row">
      <div class="total-label">รวมเป็นเงิน</div>
      <div class="total-value">{fmt_money(data.get('total_amount', 0))}</div>
      <div class="total-unit">บาท</div>
    </div>
    <div class="total-row">
      <div class="total-label">ภาษีมูลค่าเพิ่ม {data.get('vat_rate', 0)}%</div>
      <div class="total-value">{fmt_money(data.get('vat_amount', 0))}</div>
      <div class="total-unit">บาท</div>
    </div>
    <div class="total-row">
      <div class="total-label">จำนวนเงินรวมทั้งสิ้น</div>
      <div class="total-value bold">{fmt_money(data.get('grand_total', 0))}</div>
      <div class="total-unit">บาท</div>
    </div>
    {wht_html}
  </div>
</div>

<!-- SIGNATURES (fixed at bottom) -->
<div class="signatures">
  <div class="sig-names">
    <div class="right">ในนาม {esc(data.get('payer_name', ''))}</div>
  </div>
  <div class="sig-lines">
    <div class="sig-block">
      <div class="sig-line">ผู้อนุมัติ</div>
      <div class="sig-line">วันที่</div>
    </div>
  </div>
</div>

</body>
</html>
'''

# ─── Generate PDF ───
font_config = FontConfiguration()
HTML(string=html_content).write_pdf(out_path, font_config=font_config)
