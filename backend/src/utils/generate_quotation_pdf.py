#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate Quotation PDF — IDEA HOUSE template (port จาก PO PDF Phase 2.3)
Reads JSON from stdin, writes PDF to argv[1].
Uses WeasyPrint (Pango+HarfBuzz) for proper Thai text shaping.

Phase 3.2B.1 — รูปแบบเดียวกับ PO PDF
- Title navy (#183b59) แทน pink ของ PO
- Customer block แทน Supplier block
- Column "หน่วย" เพิ่มในตาราง
- Discount row + Notes block
- Stamp toggle ผ่าน data['show_stamp']
- Signature: ลูกค้าตอบรับ (ซ้าย) + ผู้ออกเอกสาร (ขวา)
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

# Stamp: ลองที่ assets ก่อน, fallback ไป frontend/public
STAMP_PATHS = [
    os.path.join(ASSETS_DIR, 'stamp.png'),
    os.path.join(BASE_DIR, '..', '..', '..', 'frontend', 'public', 'stamp.png'),
]
STAMP_PATH = next((p for p in STAMP_PATHS if os.path.exists(p)), None)


# ─── Helpers ───
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


def fmt_date_th(iso_date):
    """ISO 'YYYY-MM-DD' → 'D เดือน BBBB' (พ.ศ.)"""
    if not iso_date:
        return ''
    try:
        s = str(iso_date)[:10]
        y, m, d = s.split('-')
        months_th = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
                     'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
                     'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
        return f"{int(d)} {months_th[int(m)]} {int(y) + 543}"
    except Exception:
        return str(iso_date)


# ─── Read data ───
data = json.loads(sys.stdin.read())
out_path = sys.argv[1]


# ─── Build items rows ───
items_html = ''
for idx, item in enumerate(data.get('items', []), start=1):
    is_free = not item.get('product_id')
    name = esc(item.get('product_name', ''))
    brand = esc(item.get('product_brand', ''))
    model = esc(item.get('product_model', ''))
    descr = esc(item.get('description', ''))
    unit = esc(item.get('unit', '')) or '-'

    # Build description block — ชื่อสินค้า bold + brand/model + descr
    head_parts = [name]
    if brand:
        head_parts.append(brand)
    if model:
        head_parts.append(model)
    head = ' · '.join([p for p in head_parts if p])

    descr_html = f'<div class="item-desc">{descr}</div>' if descr else ''
    free_badge = '<span class="free-badge">รายการพิเศษ</span> ' if is_free else ''
    row_class = 'item-row free' if is_free else 'item-row'

    items_html += f'''
    <tr class="{row_class}">
      <td class="col-no">{idx}</td>
      <td class="col-desc">{free_badge}<span class="item-head">{head}</span>{descr_html}</td>
      <td class="col-qty">{fmt_qty(item.get('quantity', 0))}</td>
      <td class="col-unit">{unit}</td>
      <td class="col-price">{fmt_money(item.get('unit_price', 0))}</td>
      <td class="col-total">{fmt_money(item.get('line_total', 0))}</td>
    </tr>
    '''


# ─── Build meta rows (QT info on the right) ───
meta_rows = [
    ('เลขที่', data.get('quotation_no')),
    ('วันที่', fmt_date_th(data.get('issue_date'))),
    ('ยืนราคาถึง', fmt_date_th(data.get('valid_until'))),
]

# ผู้ออกเอกสาร = salesperson
sp_first = data.get('salesperson_first_name') or ''
sp_last = data.get('salesperson_last_name') or ''
sp_full = f"{sp_first} {sp_last}".strip()
if sp_full:
    meta_rows.append(('ผู้ออกเอกสาร', sp_full))

if data.get('project_name'):
    meta_rows.append(('ชื่องาน', data.get('project_name')))

meta_html = ''
for label, value in meta_rows:
    val = safe(value, '-')
    meta_html += f'''
    <div class="meta-row">
      <div class="meta-label">{esc(label)}</div>
      <div class="meta-value">{esc(val)}</div>
    </div>
    '''


# ─── Customer block (replace Supplier ของ PO) ───
contact_line = ''
if data.get('contact_name'):
    parts = [esc(data.get('contact_name'))]
    if data.get('contact_position'):
        parts.append(esc(data.get('contact_position')))
    if data.get('contact_phone'):
        parts.append(esc(data.get('contact_phone')))
    contact_line = f'<div class="contact-line">ผู้ติดต่อ: {" · ".join(parts)}</div>'


# ─── Build totals (Discount + WHT optional) ───
discount_html = ''
discount_amount = float(data.get('discount_amount') or 0)
if discount_amount > 0:
    discount_label = 'ส่วนลด'
    if data.get('discount_mode') == 'percent':
        discount_pct = float(data.get('discount_percent') or 0)
        if discount_pct > 0:
            discount_label = f'ส่วนลด {discount_pct:g}%'
    discount_html = f'''
    <div class="total-row">
      <div class="total-label">{discount_label}</div>
      <div class="total-value">-{fmt_money(discount_amount)}</div>
      <div class="total-unit">บาท</div>
    </div>
    '''

vat_html = ''
vat_amount = float(data.get('vat_amount') or 0)
if vat_amount > 0:
    vat_html = f'''
    <div class="total-row">
      <div class="total-label">ภาษีมูลค่าเพิ่ม {data.get('vat_rate', 0)}%</div>
      <div class="total-value">{fmt_money(vat_amount)}</div>
      <div class="total-unit">บาท</div>
    </div>
    '''

wht_html = ''
wht_amount = float(data.get('wht_amount') or 0)
if wht_amount > 0:
    net_payable = float(data.get('net_payable') or 0)
    wht_html = f'''
    <hr class="total-divider">
    <div class="total-row">
      <div class="total-label">หัก ณ ที่จ่าย {data.get('wht_rate', 0)}%</div>
      <div class="total-value">{fmt_money(wht_amount)}</div>
      <div class="total-unit">บาท</div>
    </div>
    <div class="total-row">
      <div class="total-label">ยอดชำระ</div>
      <div class="total-value navy bold">{fmt_money(net_payable)}</div>
      <div class="total-unit">บาท</div>
    </div>
    '''


# ─── Notes block (optional) ───
notes_html = ''
if data.get('notes'):
    notes_html = f'''
    <div class="notes-block">
      <div class="notes-label">หมายเหตุ</div>
      <div class="notes-content">{esc(data.get('notes'))}</div>
    </div>
    '''


# ─── Logo block ───
if os.path.exists(LOGO_PATH):
    logo_html = f'<img src="file://{LOGO_PATH}" class="logo">'
else:
    logo_html = '<div class="logo-text"><div class="logo-main">IDEA HOUSE</div><div class="logo-sub">C E N T E R</div></div>'


# ─── Stamp block (optional, fixed at bottom right) ───
stamp_html = ''
if data.get('show_stamp') and STAMP_PATH:
    stamp_html = f'<img src="file://{STAMP_PATH}" class="stamp">'


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
  margin: 85mm 14mm 18mm 14mm;
  @top-left {{
    content: element(pageHeader);
    width: 100%;
  }}
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

.navy {{ color: #183b59; }}
.bold {{ font-weight: bold; }}
.gray {{ color: #737373; }}

/* ─── RUNNING PAGE HEADER (ทุกหน้า) ─── */
.page-header {{
  position: running(pageHeader);
  width: 100%;
  font-size: 8.5pt;
}}
.ph-top {{
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1mm;
}}
.ph-top .logo {{ width: 32mm; height: auto; }}
.ph-title {{
  font-size: 18pt; font-weight: bold; color: #183b59;
  text-align: right;
  line-height: 1;
}}
.ph-title-sub {{
  font-size: 8pt; color: #888; letter-spacing: 3px;
  text-align: right;
  margin-top: 0.5mm;
}}
.ph-info {{
  display: flex;
  justify-content: space-between;
  margin-top: 0.5mm;
}}
.ph-payer {{
  width: 110mm;
  padding-right: 4mm;
  font-size: 8.5pt;
  line-height: 1.3;
}}
.ph-payer .payer-name {{ font-weight: bold; font-size: 9pt; margin-bottom: 0.5mm; }}
.ph-meta {{
  width: 70mm;
  font-size: 8.5pt;
  border-top: 0.5pt solid #d9d9d9;
  padding-top: 0.5mm;
  line-height: 1.3;
}}
.ph-meta .meta-row {{ margin-bottom: 0.5mm; }}
.ph-customer {{
  margin-top: 2mm;
  font-size: 8.5pt;
  line-height: 1.3;
  border-top: 0.5pt solid #d9d9d9;
  border-bottom: 0.5pt solid #d9d9d9;
  padding: 1.5mm 0;
}}
.ph-customer .customer-header {{
  font-weight: bold; color: #183b59; font-size: 9pt;
  margin-bottom: 0.5mm;
}}
.ph-customer .customer-name {{ font-weight: bold; font-size: 9pt; }}
.ph-customer .contact-line {{
  margin-top: 1mm;
  padding-top: 1mm;
  border-top: 0.3pt dashed #d9d9d9;
  color: #555;
}}

/* ─── HEADER ─── */
.header {{
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2mm;
}}
.logo {{ width: 38mm; height: auto; }}
.logo-text .logo-main {{
  font-size: 14pt; font-weight: bold; color: #183b59;
}}
.logo-text .logo-sub {{
  font-size: 8pt; color: #737373; letter-spacing: 2px;
}}
.title {{
  font-size: 20pt; font-weight: bold; color: #183b59;
  text-align: right;
  line-height: 1;
}}
.title-sub {{
  font-size: 9pt; color: #888; letter-spacing: 3px;
  text-align: right;
  margin-top: 1mm;
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

/* ─── CUSTOMER ─── */
.customer {{
  margin-top: 3mm;
  font-size: 9pt;
  line-height: 1.4;
}}
.customer-header {{
  font-weight: bold;
  color: #183b59;
  font-size: 9.5pt;
  margin-bottom: 0.5mm;
}}
.customer-name {{ font-weight: bold; font-size: 9.5pt; }}
.contact-line {{
  margin-top: 1mm;
  padding-top: 1mm;
  border-top: 0.3pt dashed #d9d9d9;
  color: #555;
}}

/* ─── ITEMS TABLE ─── */
.items {{
  width: 100%;
  border-collapse: collapse;
  margin-top: 0;
  font-size: 9pt;
}}
.items thead tr {{
  background: #183b59;
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
.items .col-qty {{ width: 14mm; text-align: right; }}
.items .col-unit {{ width: 14mm; text-align: center; }}
.items .col-price {{ width: 23mm; text-align: right; white-space: nowrap; }}
.items .col-total {{ width: 24mm; text-align: right; }}
.items th.col-qty, .items th.col-price, .items th.col-total {{
  text-align: right;
}}
.items th.col-no, .items th.col-unit {{ text-align: center; }}
.items tbody tr {{
  border-bottom: 0.3pt solid #e5e5e5;
  page-break-inside: avoid;
  break-inside: avoid;
}}

.items .item-row.free {{
  background: #fefce8;
  border-left: 2px solid #eab308;
}}
.free-badge {{
  display: inline-block;
  background: #eab308; color: white;
  font-size: 7.5pt; font-weight: bold;
  padding: 0.5mm 1.5mm; border-radius: 1.5mm;
  margin-right: 1.5mm;
  vertical-align: middle;
}}
.item-head {{ font-weight: 600; }}
.item-desc {{
  color: #555; font-size: 8.5pt;
  margin-top: 0.8mm; white-space: pre-wrap;
}}

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
.total-row.grand .total-label,
.total-row.grand .total-value,
.total-row.grand .total-unit {{
  font-weight: bold;
  color: #000;
}}
.total-row.grand {{
  border-top: 0.5pt solid #d9d9d9;
  padding-top: 1mm;
  margin-top: 1mm;
}}

/* ─── NOTES ─── */
.notes-block {{
  margin-top: 5mm;
  border: 0.5pt solid #d9d9d9;
  border-radius: 2mm;
  padding: 2mm 3mm;
  font-size: 8.5pt;
  line-height: 1.4;
}}
.notes-label {{
  font-weight: bold;
  color: #183b59;
  margin-bottom: 1mm;
  font-size: 9pt;
}}
.notes-content {{
  color: #444;
  white-space: pre-wrap;
}}

/* ─── SIGNATURES (block flow — appears after notes) ─── */
.signatures {{
  margin-top: 12mm;
  page-break-inside: avoid;
  position: relative;
}}
.sig-row {{
  display: flex;
  justify-content: space-between;
}}
.sig-block {{
  width: 80mm;
  position: relative;
}}
.sig-title {{
  font-weight: bold;
  font-size: 9pt;
  margin-bottom: 14mm;
}}
.sig-lines {{
  display: flex;
  justify-content: space-between;
}}
.sig-line {{
  width: 38mm;
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

/* ─── STAMP (overlaid in signature box, top-right area) ─── */
.stamp {{
  position: absolute;
  top: 6mm;
  right: 0mm;
  width: 30mm;
  height: auto;
  transform: rotate(-6deg);
  mix-blend-mode: multiply;
  opacity: 0.85;
  z-index: 1;
  pointer-events: none;
}}
</style>
</head>
<body>

<!-- RUNNING PAGE HEADER (ทุกหน้า) -->
<div class="page-header">
  <div class="ph-top">
    <div>{logo_html}</div>
    <div>
      <div class="ph-title">ใบเสนอราคา</div>
      <div class="ph-title-sub">QUOTATION</div>
    </div>
  </div>
  <div class="ph-info">
    <div class="ph-payer">
      <div class="payer-name">บริษัท ไอเดีย เฮ้าส์ เซ็นเตอร์ จำกัด (สำนักงานใหญ่)</div>
      <div>เลขที่ 80 อาคาร เค.เอ.เอ็น.เพลส ห้องเลขที่ 104 ชั้น 1</div>
      <div>ซอยนราธิวาสราชนครินทร์ 8 แขวงทุ่งวัดดอน เขตสาทร กรุงเทพฯ 10120</div>
      <div>เลขประจำตัวผู้เสียภาษี 0105556022070</div>
      <div>โทร. 02-003-8359, 02-003-8462 · มือถือ 086-358-3354</div>
      <div>โทรสาร 02-286-1932 · www.ideas-house.com</div>
    </div>
    <div class="ph-meta">
      {meta_html}
    </div>
  </div>
  <div class="ph-customer">
    <div class="customer-header">ลูกค้า</div>
    <div class="customer-name">{esc(data.get('customer_name', ''))}</div>
    <div>{esc(data.get('customer_address', ''))}{(' ' + esc(data.get('customer_postal_code', ''))) if data.get('customer_postal_code') else ''}</div>
    {f'<div>เลขประจำตัวผู้เสียภาษี {esc(data.get("customer_tax_id"))}{(" สาขา " + esc(data.get("customer_branch"))) if data.get("customer_branch") else ""}</div>' if data.get('customer_tax_id') else ''}
    {f'<div>โทร. {esc(data.get("customer_phone"))}</div>' if data.get('customer_phone') else ''}
    {contact_line}
  </div>
</div>

<!-- ITEMS TABLE -->
<table class="items">
  <thead>
    <tr>
      <th class="col-no">#</th>
      <th class="col-desc">รายละเอียด</th>
      <th class="col-qty">จำนวน</th>
      <th class="col-unit">หน่วย</th>
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
      <div class="total-label">ยอดรวม</div>
      <div class="total-value">{fmt_money(data.get('subtotal', 0))}</div>
      <div class="total-unit">บาท</div>
    </div>
    {discount_html}
    {vat_html}
    <div class="total-row grand">
      <div class="total-label">จำนวนเงินรวมทั้งสิ้น</div>
      <div class="total-value">{fmt_money(data.get('grand_total', 0))}</div>
      <div class="total-unit">บาท</div>
    </div>
    {wht_html}
  </div>
</div>

<!-- NOTES -->
{notes_html}

<!-- SIGNATURES (block flow + relative for stamp positioning) -->
<div class="signatures">
  {stamp_html}
  <div class="sig-row">
    <div class="sig-block">
      <div class="sig-title">ลูกค้าตอบรับ</div>
      <div class="sig-lines">
        <div class="sig-line">ผู้อนุมัติ</div>
        <div class="sig-line">วันที่</div>
      </div>
    </div>
    <div class="sig-block">
      <div class="sig-title">ในนาม บริษัท ไอเดีย เฮ้าส์ เซ็นเตอร์ จำกัด</div>
      <div class="sig-lines">
        <div class="sig-line">ผู้ออกเอกสาร</div>
        <div class="sig-line">วันที่</div>
      </div>
    </div>
  </div>
</div>

</body>
</html>
'''

# ─── Generate PDF ───
font_config = FontConfiguration()
HTML(string=html_content).write_pdf(out_path, font_config=font_config)
