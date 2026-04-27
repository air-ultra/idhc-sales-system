# 📌 New Sections — Append to PROJECT_CONTEXT.md

## ⚠️ วิธีใช้
- เพิ่ม **3 sections** ด้านล่างนี้เข้าใน `PROJECT_CONTEXT.md`
- **อย่าแทนที่** เนื้อหาเดิม — แค่ **append** เข้าด้านล่าง
- ตำแหน่งที่แนะนำ: **ก่อน** section "🛠️ 9. วิธี Deploy การเปลี่ยน Code"

---

## 📦 SECTION 1 — เพิ่มที่ใต้หัวข้อ "🗄️ 7. Database Schema"

### 7.X Enum Values (สำคัญ — ห้ามเดา query ก่อน)

```sql
-- staff_salary.employee_type
'monthly'   -- รายเดือน (default)
'daily'     -- รายวัน
'contract'  -- รายสัญญาจ้าง / จ้างเหมา

-- payroll.status
'draft'      -- ร่าง (แก้ไขได้)
'approved'   -- อนุมัติแล้ว (แก้ไม่ได้ ต้องยกเลิกอนุมัติก่อน)

-- purchase_orders.status
'draft' | 'approved' | 'received' | 'cancelled'   -- ตรวจอีกครั้งใน DB

-- ทุกครั้งที่จะ filter/group ตาม column นี้:
-- DOCKER COMPOSE EXEC -T sales-db psql -U sales_admin -d sales_system -c \
--   "SELECT column, COUNT(*) FROM table_name GROUP BY column;"
```

---

## 📦 SECTION 2 — เพิ่ม section ใหม่หลัง section "🔧 5. Backend Pattern"

### 5.X PDF Generation — WeasyPrint Pattern

**สำคัญ:** โปรเจคนี้ใช้ **WeasyPrint** เท่านั้น — **ห้ามใช้ ReportLab**

**เหตุผล:**
- WeasyPrint ใช้ Pango + HarfBuzz → text shaping ภาษาไทยถูกต้อง (สระ/วรรณยุกต์ไม่ทับ)
- ReportLab ไม่มี shaping engine → ภาษาไทยซ้อนทับเกือบทุกขนาด font

**Pattern ทุกไฟล์ใน `backend/src/utils/generate_*.py`:**

```python
#!/usr/bin/env python3
import sys, json, os, html as html_lib
from weasyprint import HTML
from weasyprint.text.fonts import FontConfiguration

# Font path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(BASE_DIR, '..', 'fonts')
FONT_REG = os.path.join(FONT_DIR, 'Sarabun-Regular.ttf')
FONT_BOLD = os.path.join(FONT_DIR, 'Sarabun-Bold.ttf')

# Read JSON from stdin
data = json.loads(sys.stdin.read())
out_path = sys.argv[1]

# Build HTML string
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
@page {{ size: A4; margin: 14mm; }}
body {{ font-family: 'Sarabun', sans-serif; font-size: 11pt; }}
... CSS อื่นๆ ...
</style>
</head>
<body>
... HTML content ...
</body>
</html>'''

# Generate PDF
font_config = FontConfiguration()
HTML(string=html_content).write_pdf(out_path, font_config=font_config)
```

**เรียกจาก Node.js route:**
```js
const { execSync } = require('child_process');
const tmpJson = '/tmp/data_xxx.json';
const tmpPdf = '/tmp/output_xxx.pdf';
fs.writeFileSync(tmpJson, JSON.stringify(data));
const scriptPath = path.join(__dirname, '..', 'utils', 'generate_xxx_pdf.py');
execSync(`cat "${tmpJson}" | python3 "${scriptPath}" "${tmpPdf}"`);
const pdfBuf = fs.readFileSync(tmpPdf);
```

**ไฟล์อ้างอิง (ตัวอย่างที่ดี):**
- `backend/src/utils/generate_po_pdf.py` — Purchase Order
- `backend/src/utils/generate_payroll_pdf.py` — รายงานเงินเดือน
- `backend/src/utils/generate_payslip_pdf.py` — สลิปเงินเดือน
- `backend/src/utils/generate_sso_pdf.py` — สปส. 1-10

---

## 📦 SECTION 3 — เพิ่ม section ใหม่หลัง Feature Map / Section 8

### Payroll Documents Endpoints (Phase 2.10)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/payroll-export/excel?year=Y&month=M` | รายงานเงินเดือน Excel (แบ่ง 3 กลุ่ม) |
| `GET` | `/api/payroll-export/pdf?year=Y&month=M` | รายงานเงินเดือน PDF (WeasyPrint) |
| `GET` | `/api/payroll-documents/payslip?year=Y&month=M` | สลิปเงินเดือนทุกคน (PDF, 2 สลิป/หน้า) |
| `GET` | `/api/payroll-documents/payslip?year=Y&month=M&staff_id=N` | สลิปเงินเดือนคนเดียว |
| `GET` | `/api/payroll-documents/sso?year=Y&month=M` | สปส. 1-10 PDF (สำหรับเก็บแฟ้ม) |
| `GET` | `/api/payroll-documents/sso/excel?year=Y&month=M` | สปส. 1-10 Excel (e-Filing — sheet name `'000000'`) |
| `PUT` | `/api/payroll/unapprove/:year/:month` | ยกเลิกอนุมัติ → `approved` กลับเป็น `draft` |

**Logic ที่ต้องรู้:**
- รายงานเงินเดือน **แบ่ง 3 กลุ่ม:** รายเดือน → รายสัญญาจ้าง → รายวัน (subtotal แต่ละกลุ่ม)
- ปกส.ที่ต้องนำส่ง = `SUM(social_security) × 2` (ลูกจ้าง + นายจ้าง)
- สปส. e-Filing ใช้ **ค่าจ้างจริง** (ไม่ cap) — ส่วน PDF ใช้ **ค่าจ้างหลัง cap** (max 17,500)
- ในสปส. ดึงเฉพาะคนที่ `staff_salary.social_security_eligible = true`

---

## 📦 SECTION 4 — เพิ่มที่ใต้หัวข้อ "🛠️ 9. วิธี Deploy การเปลี่ยน Code"

### 9.X ⚠️ Anti-Pattern: คิดว่าแก้แล้วทั้งที่ยังเป็น cache เก่า

**ปัญหาที่พลาดบ่อย:** แก้ไฟล์ → restart → ยังเห็นพฤติกรรมเก่า

**สาเหตุ:** Dockerfile ใช้ `COPY src/ ./src/` ไม่ใช่ volume mount
→ ไฟล์ถูก bake เข้า image ตอน `--build`
→ **restart container เฉยๆ ไม่ refresh ไฟล์**
→ ต้อง **rebuild** image ใหม่

**วิธีตรวจว่า code ใน container ตรงกับ disk:**
```bash
# 1. ดูไฟล์บนดิสก์
ls -la backend/src/utils/generate_payroll_pdf.py

# 2. ดูไฟล์ใน container
docker compose exec sales-api ls -la /app/src/utils/generate_payroll_pdf.py

# ถ้า size/วันที่ต่าง → rebuild!
```

**Rebuild อย่างถูก:**
```bash
docker compose down sales-api
docker rmi $(docker images -q sales-system-sales-api) 2>/dev/null
docker compose up -d --build sales-api
docker compose logs --tail 15 sales-api
```

**Verify หลัง rebuild:**
```bash
# เช็คว่าเนื้อหาใหม่เข้า container แล้ว
docker compose exec sales-api grep -c "ข้อความใหม่" /app/src/utils/xxx.py
# ต้องไม่เป็น 0
```

---

## 📦 SECTION 5 — แก้ "🛠️ 9. วิธี Deploy" ส่วน "Backend เท่านั้น"

**ของเดิม:** อาจบอกว่า restart ก็พอ
**ของใหม่:** ต้องระบุชัดว่าทุกครั้งที่แก้ไฟล์ใน `backend/src/` → **rebuild**

```bash
# ❌ ผิด — แค่ restart ไม่พอ (ยกเว้นแก้แค่ .env)
docker compose restart sales-api

# ✅ ถูก — rebuild image ใหม่ทุกครั้งที่แก้ไฟล์ใน src/
docker compose down sales-api
docker rmi $(docker images -q sales-system-sales-api 2>/dev/null) 2>/dev/null
docker compose up -d --build sales-api
docker compose logs --tail 15 sales-api
```

**ข้อยกเว้น:** Python script ที่ถูกเรียกผ่าน `execSync` (เช่น `generate_*.py`) ก็ยังต้อง rebuild เพราะ Dockerfile copy เข้า image แล้ว
→ **แก้ใดๆ ใน `backend/src/` ก็ต้อง rebuild ทั้งสิ้น**
