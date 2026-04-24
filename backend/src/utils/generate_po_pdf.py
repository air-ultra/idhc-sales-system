#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate Purchase Order PDF matching IDEA HOUSE template.
Reads JSON from stdin, writes PDF to argv[1].
"""
import sys
import json
import os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ─── Fonts ───
FONT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'fonts')
pdfmetrics.registerFont(TTFont('Sarabun', os.path.join(FONT_DIR, 'Sarabun-Regular.ttf')))
pdfmetrics.registerFont(TTFont('Sarabun-Bold', os.path.join(FONT_DIR, 'Sarabun-Bold.ttf')))

# ─── Colors (hex → rgb 0-1) ───
PINK = (0.78, 0.08, 0.34)  # ~#c41556
GRAY = (0.45, 0.45, 0.45)
LIGHT_GRAY = (0.9, 0.9, 0.9)
BLACK = (0, 0, 0)

# ─── Read data ───
data = json.loads(sys.stdin.read())
out_path = sys.argv[1]

# ─── Setup canvas ───
c = canvas.Canvas(out_path, pagesize=A4)
W, H = A4
MARGIN = 15 * mm


def set_font(size=10, bold=False):
    c.setFont('Sarabun-Bold' if bold else 'Sarabun', size)


def set_color(rgb):
    c.setFillColorRGB(*rgb)


def draw_text(x, y, text, size=10, bold=False, color=BLACK):
    set_font(size, bold)
    set_color(color)
    c.drawString(x, y, str(text))


def draw_right(x, y, text, size=10, bold=False, color=BLACK):
    set_font(size, bold)
    set_color(color)
    c.drawRightString(x, y, str(text))


def draw_center(x, y, text, size=10, bold=False, color=BLACK):
    set_font(size, bold)
    set_color(color)
    c.drawCentredString(x, y, str(text))


def fmt_money(n):
    """Format number like 2,100.00"""
    try:
        return f"{float(n):,.2f}"
    except Exception:
        return "0.00"


# ═══════════════════════════════════════════════
# TOP SECTION
# ═══════════════════════════════════════════════
y = H - MARGIN

# Logo placeholder — ใช้ text logo ถ้าไม่มีรูป
logo_path = os.path.join(FONT_DIR, '..', 'assets', 'logo.png')
if os.path.exists(logo_path):
    c.drawImage(logo_path, MARGIN, y - 18*mm, width=35*mm, height=18*mm,
                preserveAspectRatio=True, mask='auto')
else:
    # text fallback
    draw_text(MARGIN, y - 6*mm, 'IDEA HOUSE', 16, True, PINK)
    draw_text(MARGIN, y - 10*mm, 'C E N T E R', 8, False, GRAY)

# Title "ใบสั่งซื้อ" (top right)
draw_right(W - MARGIN, y - 4*mm, 'ใบสั่งซื้อ', 24, True, PINK)

# ─── Payer info (left, below logo) ───
y_info = y - 22*mm
draw_text(MARGIN, y_info, data.get('payer_name', ''), 10, True)
y_info -= 4*mm
for line in data.get('payer_address', '').split('\n'):
    draw_text(MARGIN, y_info, line, 9)
    y_info -= 3.5*mm
draw_text(MARGIN, y_info, f"เลขประจำตัวผู้เสียภาษี {data.get('payer_tax_id', '')}", 9)
y_info -= 3.5*mm
draw_text(MARGIN, y_info, f"โทร. {data.get('payer_phone', '')}", 9)
y_info -= 3.5*mm
draw_text(MARGIN, y_info, f"เบอร์มือถือ {data.get('payer_mobile', '')}", 9)
y_info -= 3.5*mm
draw_text(MARGIN, y_info, f"โทรสาร {data.get('payer_fax', '')}", 9)
y_info -= 3.5*mm
draw_text(MARGIN, y_info, data.get('payer_website', ''), 9)

# ─── PO meta (right) ───
meta_x_label = W - 85*mm
meta_x_val = W - 55*mm
y_meta = y - 24*mm

def meta_row(label, value):
    global y_meta
    draw_text(meta_x_label, y_meta, label, 9.5, False, GRAY)
    draw_text(meta_x_val, y_meta, str(value), 9.5, False)
    y_meta -= 5*mm

meta_row('เลขที่', data.get('po_number', ''))
meta_row('วันที่', data.get('po_date', ''))
meta_row('เครดิต', f"{data.get('credit_days', 0)} วัน")
meta_row('ครบกำหนด', data.get('due_date', ''))
meta_row('ผู้สั่งซื้อ', data.get('ordered_by', ''))

# Job name
if data.get('job_name'):
    y_meta -= 2*mm
    draw_text(meta_x_label, y_meta, 'ชื่องาน', 9.5, False, GRAY)
    draw_text(meta_x_val, y_meta, data.get('job_name', ''), 9.5, False)

# ═══════════════════════════════════════════════
# SUPPLIER SECTION
# ═══════════════════════════════════════════════
y_sup = y_info - 8*mm
draw_text(MARGIN, y_sup, 'ผู้จำหน่าย', 10, True, PINK)
y_sup -= 4.5*mm
draw_text(MARGIN, y_sup, data.get('supplier_name', ''), 10, True)
y_sup -= 4*mm
for line in (data.get('supplier_address') or '').split('\n'):
    if line.strip():
        draw_text(MARGIN, y_sup, line, 9)
        y_sup -= 3.5*mm
if data.get('supplier_tax_id'):
    draw_text(MARGIN, y_sup, f"เลขประจำตัวผู้เสียภาษี {data.get('supplier_tax_id', '')}", 9)
    y_sup -= 3.5*mm

# ═══════════════════════════════════════════════
# ITEMS TABLE
# ═══════════════════════════════════════════════
y_table = y_sup - 8*mm

# Column definitions
col_no = MARGIN
col_desc = MARGIN + 12*mm
col_qty = W - 85*mm
col_price = W - 60*mm
col_total = W - 30*mm

# Header (pink bar)
c.setFillColorRGB(*PINK)
c.rect(MARGIN, y_table - 6*mm, W - 2*MARGIN, 7*mm, stroke=0, fill=1)

set_color((1, 1, 1))
set_font(9.5, True)
c.drawString(col_no, y_table - 4*mm, '#')
c.drawCentredString((col_desc + col_qty) / 2, y_table - 4*mm, 'รายละเอียด')
c.drawRightString(col_qty + 15*mm, y_table - 4*mm, 'จำนวน')
c.drawRightString(col_price + 15*mm, y_table - 4*mm, 'ราคาต่อหน่วย')
c.drawRightString(col_total + 15*mm, y_table - 4*mm, 'ยอดรวม')

# Rows
y_row = y_table - 10*mm
set_color(BLACK)
set_font(10, False)
for item in data.get('items', []):
    lines = str(item.get('description', '')).split('\n')
    row_height = max(5*mm, len(lines) * 4.5*mm)

    draw_text(col_no, y_row, item.get('no', ''), 10)
    for i, line in enumerate(lines):
        draw_text(col_desc, y_row - i * 4*mm, line, 10)
    draw_right(col_qty + 15*mm, y_row, fmt_money(item.get('quantity', 0)).replace('.00', ''), 10)
    draw_right(col_price + 15*mm, y_row, fmt_money(item.get('unit_price', 0)), 10)
    draw_right(col_total + 15*mm, y_row, fmt_money(item.get('total', 0)), 10)

    y_row -= row_height + 2*mm

# Divider line
c.setStrokeColorRGB(*LIGHT_GRAY)
c.setLineWidth(0.5)
c.line(MARGIN, y_row, W - MARGIN, y_row)

# ═══════════════════════════════════════════════
# TOTALS (right aligned)
# ═══════════════════════════════════════════════
y_total = y_row - 8*mm

def total_row(label, value, bold=False, color=BLACK, size=10):
    global y_total
    draw_right(W - 40*mm, y_total, label, size, False, GRAY)
    draw_right(W - 15*mm, y_total, fmt_money(value), size, bold, color)
    draw_text(W - 13*mm, y_total, 'บาท', size, False, GRAY)
    y_total -= 5*mm

# words (left side)
draw_text(MARGIN, y_total, f"({data.get('grand_total_words', '')})", 10)

total_row('รวมเป็นเงิน', data.get('total_amount', 0))
total_row(f"ภาษีมูลค่าเพิ่ม {data.get('vat_rate', 0)}%", data.get('vat_amount', 0))
total_row('จำนวนเงินรวมทั้งสิ้น', data.get('grand_total', 0), bold=True)

if data.get('show_wht'):
    y_total -= 3*mm
    # line
    c.setStrokeColorRGB(*LIGHT_GRAY)
    c.line(W - 80*mm, y_total + 2*mm, W - 10*mm, y_total + 2*mm)
    total_row(f"หักภาษี ณ ที่จ่าย {data.get('wht_rate', 0)}%", data.get('wht_amount', 0))
    total_row('ยอดชำระ', data.get('net_payment', 0), bold=True, color=PINK)

# ═══════════════════════════════════════════════
# SIGNATURES
# ═══════════════════════════════════════════════
y_sig = 45*mm

# Labels
draw_text(MARGIN, y_sig, f"ในนาม {data.get('supplier_name', '')}", 10)
draw_right(W - MARGIN, y_sig, f"ในนาม {data.get('payer_name', '')}", 10)

# Lines for signature
y_sig_line = 25*mm
c.setStrokeColorRGB(*LIGHT_GRAY)
c.line(MARGIN, y_sig_line, MARGIN + 50*mm, y_sig_line)
c.line(MARGIN + 55*mm, y_sig_line, MARGIN + 85*mm, y_sig_line)
c.line(W - MARGIN - 85*mm, y_sig_line, W - MARGIN - 55*mm, y_sig_line)
c.line(W - MARGIN - 50*mm, y_sig_line, W - MARGIN, y_sig_line)

draw_center(MARGIN + 25*mm, y_sig_line - 5*mm, 'ผู้ขาย', 9, False, GRAY)
draw_center(MARGIN + 70*mm, y_sig_line - 5*mm, 'วันที่', 9, False, GRAY)
draw_center(W - MARGIN - 70*mm, y_sig_line - 5*mm, 'ผู้อนุมัติ', 9, False, GRAY)
draw_center(W - MARGIN - 25*mm, y_sig_line - 5*mm, 'วันที่', 9, False, GRAY)

c.showPage()
c.save()
