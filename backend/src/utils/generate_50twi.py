#!/usr/bin/env python3
"""
หนังสือรับรองการหักภาษี ณ ที่จ่าย ตามมาตรา 50 ทวิ
v5 — แก้ซ้อนทับส่วนล่าง โดยลดขนาด sub-rows + ปรับ spacing ทั้งหมด
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import black, HexColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# Default font registration (overridden in CLI mode)
_script_dir = os.path.dirname(os.path.abspath(__file__))
_font_dir = os.path.join(_script_dir, '..', 'fonts')
try:
    pdfmetrics.registerFont(TTFont('S', os.path.join(_font_dir, 'Sarabun-Regular.ttf')))
    pdfmetrics.registerFont(TTFont('SB', os.path.join(_font_dir, 'Sarabun-Bold.ttf')))
except:
    pass

W, H = A4
GR = HexColor('#777777')

def cb(c, x, y, chk=False, sz=8):
    c.saveState(); c.setLineWidth(0.5)
    c.rect(x, y, sz, sz, stroke=1, fill=0)
    if chk:
        c.setLineWidth(1.2)
        c.line(x+1.5, y+sz/2, x+sz/3, y+1.5)
        c.line(x+sz/3, y+1.5, x+sz-1.5, y+sz-1.5)
    c.restoreState()

def tid(c, x, y, s, bw=8, bh=10):
    digs = s.replace('-','')
    grps = [1,4,5,2,1]; dx=x; i=0
    for gi, gs in enumerate(grps):
        for _ in range(gs):
            c.rect(dx, y, bw, bh, stroke=1, fill=0)
            if i < len(digs):
                c.setFont('S', 7)
                c.drawCentredString(dx+bw/2, y+1.5, digs[i])
            i += 1; dx += bw
        if gi < len(grps)-1:
            c.setFont('SB', 8)
            c.drawCentredString(dx+2, y+0.5, '-')
            dx += 5

def fm(v):
    if not v or float(v)==0: return ''
    return f"{float(v):,.2f}"

def hl(c, x1, x2, y):
    c.setDash(1,1.5); c.setLineWidth(0.3)
    c.line(x1, y, x2, y)
    c.setDash(); c.setLineWidth(0.5)

def render_page(c, d):
    """วาด 1 หน้าใบ 50 ทวิ บน canvas ที่กำหนด (caller จัดการ canvas + showPage/save)"""
    LM=28; RM=W-28; BW=RM-LM

    # ═══ ฉบับที่ ═══
    y = H - 22
    cn = d.get('copy_no',1)
    c.setFont('SB' if cn==1 else 'S', 7); c.setFillColor(GR)
    c.drawString(LM, y, 'ฉบับที่ 1  (สำหรับผู้ถูกหักภาษี ณ ที่จ่าย ใช้แนบพร้อมกับแบบแสดงรายการภาษี)')
    y -= 9
    c.setFont('SB' if cn==2 else 'S', 7)
    c.drawString(LM, y, 'ฉบับที่ 2  (สำหรับผู้ถูกหักภาษี ณ ที่จ่าย เก็บไว้เป็นหลักฐาน)')
    c.setFillColor(black)

    # ═══ MAIN BOX ═══
    bt = y - 5; bb = 25
    c.setLineWidth(1); c.rect(LM, bb, BW, bt-bb); c.setLineWidth(0.5)

    # ═══ TITLE ═══
    y = bt - 18
    c.setFont('SB', 14)
    c.drawCentredString(W/2, y, 'หนังสือรับรองการหักภาษี ณ ที่จ่าย')
    y -= 15
    c.setFont('S', 10)
    c.drawCentredString(W/2, y, 'ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร')

    c.setFont('S', 8)
    c.drawString(RM-95, bt-14, f"เล่มที่..{d.get('book_no','')}..........")
    c.drawString(RM-95, bt-27, f"เลขที่..{d.get('doc_no','')}")

    # ═══ ผู้มีหน้าที่หักภาษี ═══
    y -= 16
    c.setFillColor(HexColor('#eeeeee'))
    c.rect(LM+1, y-1, 185, 12, stroke=0, fill=1)
    c.setFillColor(black)
    c.setFont('SB', 9.5); c.drawString(LM+4, y, 'ผู้มีหน้าที่หักภาษี ณ ที่จ่าย : -')

    c.setFont('S', 7.5); c.drawString(RM-220, y+1, 'เลขประจำตัวประชาชน')
    tid(c, RM-126, y-2, d['payer_tax_id'])

    y -= 17
    c.setFont('S', 9); c.drawString(LM+4, y, 'ชื่อ')
    c.setFont('S', 9.5); c.drawString(LM+22, y, d['payer_name'])
    hl(c, LM+20, RM-225, y-2)
    c.setFont('S', 7.5); c.drawString(RM-220, y+1, 'เลขประจำตัวผู้เสียภาษีอากร')
    tid(c, RM-126, y-2, d['payer_tax_id'])

    y -= 11
    c.setFont('S', 6.5); c.setFillColor(GR)
    c.drawString(LM+4, y, '(ให้ระบุว่าเป็น บุคคล นิติบุคคล บริษัท สมาคม หรือคณะบุคคล)')
    c.drawString(RM-215, y, '(ให้กรอกเฉพาะผู้ไม่มีเลขประจำตัวประชาชน)')
    c.setFillColor(black)

    y -= 14
    c.setFont('S', 9); c.drawString(LM+4, y, 'ที่อยู่')
    c.setFont('S', 8.5); c.drawString(LM+27, y, d['payer_address'])
    hl(c, LM+25, RM-2, y-2)

    y -= 10
    c.setFont('S', 6.5); c.setFillColor(GR)
    c.drawString(LM+4, y, '(ให้ระบุ ชื่ออาคาร/หมู่บ้าน ห้องเลขที่ ชั้นที่ เลขที่ ตรอก/ซอย หมู่ที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)')
    c.setFillColor(black)

    y -= 7; c.line(LM+1, y, RM-1, y)

    # ═══ ผู้ถูกหักภาษี ═══
    y -= 14
    c.setFillColor(HexColor('#eeeeee'))
    c.rect(LM+1, y-1, 160, 12, stroke=0, fill=1)
    c.setFillColor(black)
    c.setFont('SB', 9.5); c.drawString(LM+4, y, 'ผู้ถูกหักภาษี ณ ที่จ่าย : -')

    c.setFont('S', 7.5); c.drawString(RM-220, y+1, 'เลขประจำตัวประชาชน')
    tid(c, RM-126, y-2, d['payee_tax_id'])

    y -= 17
    c.setFont('S', 9); c.drawString(LM+4, y, 'ชื่อ')
    c.setFont('S', 9.5); c.drawString(LM+22, y, d['payee_name'])
    hl(c, LM+20, RM-225, y-2)
    c.setFont('S', 7.5); c.drawString(RM-220, y+1, 'เลขประจำตัวผู้เสียภาษีอากร')
    tid(c, RM-126, y-2, d['payee_tax_id'])

    y -= 11
    c.setFont('S', 6.5); c.setFillColor(GR)
    c.drawString(LM+4, y, '(ให้ระบุว่าเป็น บุคคล นิติบุคคล บริษัท สมาคม หรือคณะบุคคล)')
    c.drawString(RM-215, y, '(ให้กรอกเฉพาะผู้ไม่มีเลขประจำตัวประชาชน)')
    c.setFillColor(black)

    y -= 14
    c.setFont('S', 9); c.drawString(LM+4, y, 'ที่อยู่')
    c.setFont('S', 8.5); c.drawString(LM+27, y, d['payee_address'])
    hl(c, LM+25, RM-2, y-2)

    y -= 10
    c.setFont('S', 6.5); c.setFillColor(GR)
    c.drawString(LM+4, y, '(ให้ระบุ ชื่ออาคาร/หมู่บ้าน ห้องเลขที่ ชั้นที่ เลขที่ ตรอก/ซอย หมู่ที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)')
    c.setFillColor(black)

    y -= 7; c.line(LM+1, y, RM-1, y)

    # ═══ ลำดับที่ ═══
    y -= 15
    c.setFont('SB', 9); c.drawString(LM+4, y, 'ลำดับที่')
    c.rect(LM+42, y-3, 28, 14, stroke=1, fill=0)
    c.setFont('S', 10); c.drawCentredString(LM+56, y, str(d.get('pnd_seq','')))
    c.setFont('S', 9); c.drawString(LM+75, y, 'ในแบบ')

    pnd = d.get('pnd_form','')
    # Collect all pnd_forms from items
    pnd_set = set()
    pnd_set.add(pnd)
    for item in d.get('items', []):
        if item.get('pnd_form'):
            pnd_set.add(item['pnd_form'])
    
    r1 = [('(1)','ภ.ง.ด.1ก'),('(2)','ภ.ง.ด.1ก พิเศษ'),('(3)','ภ.ง.ด.2'),('(4)','ภ.ง.ด.3')]
    r2 = [('(5)','ภ.ง.ด.2ก'),('(6)','ภ.ง.ด.3ก'),('(7)','ภ.ง.ด.53')]

    dx = LM+105
    for n,v in r1:
        c.setFont('S',7.5); c.drawString(dx,y,n)
        cb(c, dx+14, y-1, v in pnd_set)
        c.setFont('S',8); c.drawString(dx+24,y,v)
        dx += 95

    y -= 14; c.line(LM+1, y, RM-1, y)

    y -= 15
    c.setFont('S', 5.5); c.setFillColor(GR)
    c.drawString(LM+4, y+2, '(ให้สามารถอ้างอิงหรือสอบยันกันได้ระหว่างลำดับที่')
    c.drawString(LM+4, y-5, ' ตามหนังสือรับรองฯ กับแบบยื่นรายการภาษีหักที่จ่าย)')
    c.setFillColor(black)
    dx = LM+210
    for n,v in r2:
        c.setFont('S',7.5); c.drawString(dx,y,n)
        cb(c, dx+14, y-1, v in pnd_set)
        c.setFont('S',8); c.drawString(dx+24,y,v)
        dx += 105

    y -= 12; c.line(LM+1, y, RM-1, y)

    # ═══ TABLE ═══
    c1=LM; c2=LM+275; c3=LM+358; c4=LM+445
    hh = 26

    c.setLineWidth(0.6)
    c.rect(c1, y-hh, RM-c1, hh, stroke=1, fill=0)
    c.line(c2,y,c2,y-hh); c.line(c3,y,c3,y-hh); c.line(c4,y,c4,y-hh)
    c.setLineWidth(0.5)

    c.setFont('SB',8)
    c.drawCentredString((c1+c2)/2, y-14, 'ประเภทเงินได้พึงประเมินที่จ่าย')
    c.setFont('SB',7)
    c.drawCentredString((c2+c3)/2, y-8, 'วัน เดือน')
    c.drawCentredString((c2+c3)/2, y-16, 'หรือปีภาษี ที่จ่าย')
    c.drawCentredString((c3+c4)/2, y-14, 'จำนวนเงินที่จ่าย')
    c.drawCentredString((c4+RM)/2, y-8, 'ภาษีที่หัก')
    c.drawCentredString((c4+RM)/2, y-16, 'และนำส่งไว้')

    y -= hh
    tt = y

    # Group items by income_type
    items = d.get('items', [])
    type_groups = {}
    for item in items:
        itype = item.get('income_type', d.get('income_type', ''))
        if itype not in type_groups:
            type_groups[itype] = {'dates': [], 'income': 0, 'tax': 0}
        type_groups[itype]['dates'].append(item.get('pay_date', ''))
        type_groups[itype]['income'] += float(item.get('income_amount', 0))
        type_groups[itype]['tax'] += float(item.get('tax_amount', 0))

    rh = 15  # main row height

    def fa_type(yy, rh2, key):
        """fill amounts for a specific income type"""
        if key in type_groups:
            g = type_groups[key]
            c.setFont('S',8)
            dates = ', '.join([d2 for d2 in g['dates'] if d2])
            if dates:
                c.drawCentredString((c2+c3)/2, yy-rh2+3.5, dates[:18])
            c.drawRightString(c4-3, yy-rh2+3.5, fm(g['income']))
            c.drawRightString(RM-3, yy-rh2+3.5, fm(g['tax']))

    def row(yy, txt, key, h=15):
        c.line(c1,yy-h,RM,yy-h)
        c.setFont('S',7.5); c.drawString(c1+3, yy-h+4, txt)
        fa_type(yy, h, key)
        return yy-h

    def sub(yy, txt, h=12):
        c.line(c1,yy-h,RM,yy-h)
        c.setFont('S',6.5); c.drawString(c1+8, yy-h+3.5, txt)
        return yy-h

    y = row(y, '1. เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส ฯลฯ ตามมาตรา 40 (1)', '40(1)')
    y = row(y, '2. ค่าธรรมเนียม ค่านายหน้า ฯลฯ ตามมาตรา 40 (2)', '40(2)')
    y = row(y, '3. ค่าแห่งลิขสิทธิ์ ฯลฯ ตามมาตรา 40 (3)', '40(3)')
    y = row(y, '4. (ก) ดอกเบี้ย ฯลฯ ตามมาตรา 40 (4) (ก)', '40(4)ก')
    y = row(y, '   (ข) เงินปันผล เงินส่วนแบ่งกำไร ฯลฯ ตามมาตรา 40 (4) (ข)', '40(4)ข')

    y = sub(y, '(1) กรณีผู้ได้รับเงินปันผลได้รับเครดิตภาษี โดยจ่ายจาก')
    y = sub(y, '     กำไรสุทธิของกิจการที่ต้องเสียภาษีเงินได้นิติบุคคลในอัตราดังนี้')
    y = sub(y, '     (1.1) อัตราร้อยละ 30  ของกำไรสุทธิ')
    y = sub(y, '     (1.2) อัตราร้อยละ 25  ของกำไรสุทธิ')
    y = sub(y, '     (1.3) อัตราร้อยละ 20  ของกำไรสุทธิ')
    y = sub(y, '     (1.4) อัตราอื่น ๆ (ระบุ)................ ของกำไรสุทธิ')
    y = sub(y, '(2) กรณีผู้ได้รับเงินปันผลไม่ได้รับเครดิตภาษี เนื่องจากจ่ายจาก')
    y = sub(y, '     (2.1) กำไรสุทธิของกิจการที่ได้รับยกเว้นภาษีเงินได้นิติบุคคล')
    y = sub(y, '     (2.2) เงินปันผลหรือเงินส่วนแบ่งของกำไรที่ได้รับยกเว้นไม่ต้องนำมารวม')
    y = sub(y, '           คำนวณเป็นรายได้เพื่อเสียภาษีเงินได้นิติบุคคล')
    y = sub(y, '     (2.3) กำไรสุทธิส่วนที่ได้หักผลขาดทุนสุทธิยกมาไม่เกิน 5 ปี')
    y = sub(y, '           ก่อนรอบระยะเวลาบัญชีปีปัจจุบัน')
    y = sub(y, '     (2.4) กำไรที่รับรู้ทางบัญชีโดยวิธีส่วนได้เสีย (equity method)')
    y = sub(y, '     (2.5) อื่น ๆ (ระบุ)............................')

    # Row 5: ม.3 เตรส
    r5h = 44
    c.line(c1, y-r5h, RM, y-r5h)
    c.setFont('S',7)
    c.drawString(c1+3, y-10, '5. การจ่ายเงินได้ที่ต้องหักภาษี ณ ที่จ่าย ตามคำสั่งกรมสรรพากรที่ออกตามมาตรา')
    c.drawString(c1+10, y-20, '3 เตรส เช่น รางวัล ส่วนลดหรือประโยชน์ใด ๆ เนื่องจากการส่งเสริมการขาย รางวัล')
    c.drawString(c1+10, y-30, 'ในการประกวด การแข่งขัน การชิงโชค ค่าแสดงของนักแสดงสาธารณะ ค่าจ้าง')
    c.drawString(c1+10, y-40, 'ทำของ ค่าโฆษณา ค่าเช่า ค่าขนส่ง ค่าบริการ ค่าเบี้ยประกันวินาศภัย ฯลฯ')
    if 'ม.3 เตรส' in type_groups:
        g = type_groups['ม.3 เตรส']
        c.setFont('S',8)
        dates = ', '.join([d2 for d2 in g['dates'] if d2])
        if dates:
            c.drawCentredString((c2+c3)/2, y-22, dates[:18])
        c.drawRightString(c4-3, y-22, fm(g['income']))
        c.drawRightString(RM-3, y-22, fm(g['tax']))
    y -= r5h

    # Row 6 - อื่นๆ: show description from items
    other_desc = ''
    if 'อื่นๆ' in type_groups:
        # Get descriptions from items with income_type == 'อื่นๆ'
        descs = [item.get('description','') for item in items if item.get('income_type','') == 'อื่นๆ' and item.get('description','')]
        other_desc = ', '.join(descs)
    row6_text = f'6. อื่น ๆ (ระบุ) {other_desc}' if other_desc else '6. อื่น ๆ (ระบุ)...................................................................................................................'
    y = row(y, row6_text, 'อื่นๆ')

    tb = y
    # Vertical column lines
    c.line(c2,tt,c2,tb); c.line(c3,tt,c3,tb); c.line(c4,tt,c4,tb)

    # ═══ TOTAL ═══
    trh = 18
    c.setLineWidth(0.7)
    c.rect(c1, y-trh, RM-c1, trh, stroke=1, fill=0)
    c.line(c2,y,c2,y-trh); c.line(c3,y,c3,y-trh); c.line(c4,y,c4,y-trh)
    c.setLineWidth(0.5)
    c.setFont('SB',8.5)
    c.drawCentredString((c1+c2)/2, y-12, 'รวมเงินที่จ่ายและภาษีที่หักนำส่ง')
    c.setFont('SB',9)
    c.drawRightString(c4-3, y-12, fm(d.get('total_income',0)))
    c.drawRightString(RM-3, y-12, fm(d.get('total_tax',0)))
    y -= trh

    # ═══ ตัวอักษร ═══
    y -= 10
    c.setFont('SB',8.5); c.drawString(LM+4, y, 'รวมเงินภาษีที่หักนำส่ง (ตัวอักษร)')
    c.setFont('S',9); c.drawString(LM+170, y, d.get('tax_words',''))

    y -= 12; c.line(LM+1, y, RM-1, y)

    # ═══ กองทุน ═══
    y -= 16
    c.setFont('S',7.5)
    c.drawString(LM+4, y, 'เงินที่จ่ายเข้า กบข./กสจ./กองทุนสงเคราะห์ครูโรงเรียนเอกชน..............บาท')
    c.drawString(LM+290, y, 'กองทุนประกันสังคม..............บาท')
    c.drawString(LM+420, y, 'กองทุนสำรองเลี้ยงชีพ..............บาท')
    if d.get('fund_gpf'): c.drawString(LM+235, y, fm(d['fund_gpf']))
    if d.get('fund_sso'): c.drawString(LM+365, y, fm(d['fund_sso']))
    if d.get('fund_pvf'): c.drawString(LM+500, y, fm(d['fund_pvf']))

    y -= 12; c.line(LM+1, y, RM-1, y)

    # ═══ ผู้จ่ายเงิน ═══
    y -= 18
    c.setFont('SB',8.5); c.drawString(LM+4, y, 'ผู้จ่ายเงิน')
    m = d.get('withhold_method',1)
    ml = [(1,'หัก ณ ที่จ่าย'),(2,'ออกให้ตลอดไป'),(3,'ออกให้ครั้งเดียว')]
    dx = LM+58
    for v,lb in ml:
        c.setFont('S',8); c.drawString(dx,y,f'({v})')
        cb(c, dx+13, y-1, m==v, sz=8)
        c.drawString(dx+23,y,lb); dx += 100
    c.setFont('S',8); c.drawString(dx,y,'(4)')
    cb(c, dx+13, y-1, m==4, sz=8)
    c.drawString(dx+23,y,'อื่น ๆ (ระบุ).................................')

    y -= 10; c.line(LM+1, y, RM-1, y)

    # ═══ คำเตือน + คำรับรอง ═══
    mx = LM + BW*0.40

    # Center content vertically: available space = y - bb, content height ~60
    content_h = 60
    pad = (y - bb - content_h) / 2
    cy = y - pad  # start y for content

    c.setFont('SB',8); c.drawString(LM+4, cy-10, 'คำเตือน')
    c.setFont('S',7)
    c.drawString(LM+8, cy-23, 'ผู้มีหน้าที่ออกหนังสือรับรองการหักภาษี ณ ที่จ่าย')
    c.drawString(LM+8, cy-34, 'ฝ่าฝืนไม่ปฏิบัติตามมาตรา 50 ทวิ แห่งประมวล')
    c.drawString(LM+8, cy-45, 'รัษฎากร ต้องรับโทษทางอาญาตามมาตรา 35')
    c.drawString(LM+8, cy-56, 'แห่งประมวลรัษฎากร')

    c.line(mx, y, mx, bb+1)

    c.setFont('S',8)
    c.drawString(mx+8, cy-10, 'ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความจริงทุกประการ')
    c.setFont('S',8.5)
    c.drawString(mx+28, cy-30, 'ลงชื่อ..........................................................ผู้จ่ายเงิน')

    # ประทับตรา
    # box: x=RM-68, y=cy-58, w=58, h=42 → center_x=RM-39, center_y=cy-37
    c.setDash(2,2)
    c.rect(RM-68, cy-58, 58, 42, stroke=1, fill=0)
    c.setDash()
    c.setFont('S',7)
    c.drawCentredString(RM-39, cy-34, 'ประทับตรา')
    c.drawCentredString(RM-39, cy-43, 'นิติบุคคล')
    c.drawCentredString(RM-39, cy-52, '(ถ้ามี)')

    c.setFont('S',8.5)
    if d.get('issue_date'):
        c.drawString(mx+42, cy-46, f"..........{d['issue_date']}..........")
    c.setFont('S',7)
    c.drawString(mx+38, cy-56, '(วัน เดือน ปี ที่ออกหนังสือรับรองฯ)')


def _num_to_thai_words(n):
    """แปลงตัวเลขเป็นคำอ่านภาษาไทย (สำหรับ tax_words ของแต่ละหน้า)"""
    if n is None: return ''
    try: n = float(n)
    except (TypeError, ValueError): return ''
    if n <= 0: return 'ศูนย์บาทถ้วน'
    digits = ['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า']
    units = ['','สิบ','ร้อย','พัน','หมื่น','แสน','ล้าน']
    def read_int(s):
        s = str(int(s))
        if len(s) > 7:
            head = s[:-6]; tail = s[-6:]
            return read_int(head) + 'ล้าน' + (read_int(tail) if int(tail) else '')
        out = ''
        L = len(s)
        for i, ch in enumerate(s):
            d = int(ch); pos = L - i - 1
            if d == 0: continue
            if pos == 0 and d == 1 and L > 1: out += 'เอ็ด'
            elif pos == 1 and d == 2: out += 'ยี่' + units[1]
            elif pos == 1 and d == 1: out += units[1]
            else: out += digits[d] + units[pos]
        return out or 'ศูนย์'
    s = f"{n:.2f}"
    int_part, dec_part = s.split('.')
    txt = read_int(int_part) + 'บาท'
    if int(dec_part) == 0:
        txt += 'ถ้วน'
    else:
        txt += read_int(dec_part) + 'สตางค์'
    return txt


def generate(fname, d):
    """
    สร้าง PDF 50 ทวิ — ถ้ามี items หลาย row จะออกใบแยกหลายหน้า (1 หน้า / row)
    แต่ละหน้าใช้ header เดียวกัน แต่ items สำหรับหน้านั้นมี 1 row
    """
    c = canvas.Canvas(fname, pagesize=A4)
    c.setLineWidth(0.5)

    items = d.get('items', [])
    # ถ้าไม่มี items → ออก 1 หน้าตามข้อมูล header
    if not items:
        render_page(c, d)
        c.save()
        return

    # ออก 1 หน้าต่อ row item
    for idx, item in enumerate(items):
        # สร้าง dict สำหรับหน้านั้น — ใช้ header ของ d + items แค่ 1 element
        income = float(item.get('income_amount', 0) or 0)
        tax = float(item.get('tax_amount', 0) or 0)
        page_d = dict(d)  # shallow copy header
        page_d['items'] = [item]
        # override header pnd_form ด้วย item.pnd_form (ถ้ามี) เพื่อให้ checkbox ตรง
        if item.get('pnd_form'):
            page_d['pnd_form'] = item['pnd_form']
        # override header income_type ด้วย item.income_type (ถ้ามี)
        if item.get('income_type'):
            page_d['income_type'] = item['income_type']
        # คำนวณ total_income/tax และ tax_words ของหน้านั้น (เฉพาะ row นี้)
        page_d['total_income'] = income
        page_d['total_tax'] = tax
        page_d['tax_words'] = _num_to_thai_words(tax)

        render_page(c, page_d)
        # ขึ้นหน้าใหม่ ยกเว้น row สุดท้าย
        if idx < len(items) - 1:
            c.showPage()

    c.save()


# ═══ CLI MODE: read JSON from stdin, output PDF to argv[1] ═══
if __name__ == '__main__':
    import sys, json
    if len(sys.argv) < 2:
        print("Usage: python3 generate_50twi.py <output.pdf>", file=sys.stderr)
        sys.exit(1)

    # Update font paths relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    font_dir = os.path.join(script_dir, '..', 'fonts')
    pdfmetrics.registerFont(TTFont('S', os.path.join(font_dir, 'Sarabun-Regular.ttf')))
    pdfmetrics.registerFont(TTFont('SB', os.path.join(font_dir, 'Sarabun-Bold.ttf')))

    data = json.loads(sys.stdin.read())
    out_path = sys.argv[1]
    generate(out_path, data)
    print(json.dumps({"ok": True, "path": out_path}))
