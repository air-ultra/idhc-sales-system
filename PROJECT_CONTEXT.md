# IDHC Sales Management System — Project Context

> เอกสารสำหรับ Claude (หรือใครก็ตาม) ที่จะเข้ามาช่วยพัฒนาระบบนี้ต่อ
> **อ่านให้จบก่อนเริ่มเขียน code** เพื่อไม่ให้ต้องมาแก้ทีหลัง

---

## 📌 1. ภาพรวมระบบ

- **ชื่อโปรเจค:** IDHC Sales Management System
- **Stack:** React (Vite) + Node.js/Express + PostgreSQL + Docker Compose
- **Repo:** https://github.com/air-ultra/idhc-sales-system
- **VM:** `203.154.11.200` (inet Cloud), project path: `/home/IDEA-HOUSE/sales-system/`
- **Web URL:** `http://203.154.11.200:3080`
- **ภาษาสื่อสาร:** ภาษาไทย (เรียกผู้ใช้ว่า "พี่")

### Containers
| Service | Port | หน้าที่ |
|---|---|---|
| `sales-db` | 5434 (host) → 5432 | PostgreSQL 16 |
| `sales-api` | 4000 | Node.js/Express API |
| `sales-web` | 3080 → 80 | React + Nginx |

### Company Info (ไอเดีย เฮ้าส์ เซ็นเตอร์ — บริษัทเรา)
```
ชื่อเต็ม: บริษัท ไอเดีย เฮ้าส์ เซ็นเตอร์ จำกัด (สำนักงานใหญ่)
เลขผู้เสียภาษี: 0105556022070
ที่อยู่: เลขที่ 80 อาคาร เค.เอ.เอ็น.เพลส ห้องเลขที่ 104
        ชั้น 1 ซอยนราธิวาสราชนครินทร์ 8 แขวงทุ่งวัดดอน เขตสาทร กรุงเทพฯ 10120
โทร: 02-003-8359, 02-003-8462
มือถือ: 086-358-3354
โทรสาร: 02-286-1932
เว็บไซต์: www.ideas-house.com
```
ข้อมูลนี้ hard-code ไว้ใน `purchaseOrders.js` (สำหรับสร้างใบหัก ณ ที่จ่าย + PDF)
และใน `WithholdingTaxPage.jsx` (DEFAULT_PAYER)

---

## 🗂️ 2. โครงสร้าง Code

### Backend (`backend/src/`)
```
config/database.js       # export { pool, query, getClient }
middleware/auth.js       # export { authenticate, requirePermission }
                         # accepts token from Authorization header OR ?t= query string
routes/
  auth.js
  staff.js
  staffDetail.js         # upload/download/delete pattern อยู่ที่นี่
  users.js
  payroll.js
  withholdingTax.js      # มี Thai num→words + PDF generator
  products.js
  suppliers.js
  purchaseOrders.js      # ⚠️ camelCase, มี 18+ endpoints รวม billing/payment/WHT/PDF/docs/slip/multi-WHT
  product-categories.js  # ⚠️ มี dash
  companyBankAccounts.js # ⚠️ camelCase — Bank accounts ของบริษัท (Phase 2.8)
  customers.js           # Customer master + contacts + documents (Phase 3.1)
utils/
  generate_50twi.py      # PDF ใบหัก ณ ที่จ่าย — multi-page (1 row = 1 page) Phase B1
  generate_po_pdf.py     # PDF ใบสั่งซื้อ (IDEA HOUSE template)
fonts/
  Sarabun-Regular.ttf
  Sarabun-Bold.ttf
migrations/init.sql
seeds/seed.sql
index.js                 # main entry - require routes + app.use
```

### Frontend (`frontend/src/`)
```
App.jsx                  # ⚠️ single-file ทั้งหมด ~3950+ บรรทัด (~210KB)
  บรรทัด 1-5   : imports + authHeaders + react-router-dom imports
  บรรทัด 7-100 : const styles = { ... }   ← ต้องใช้ตัวนี้เท่านั้น
                  + global CSS: ลบ spinner ของ input number
  บรรทัด 100+  : components ทั้งหมด (Login, Layout, Page, Modal)
                  + Domain constants top-level: PND_FORMS, INCOME_TYPES, WHT_RATES
                  + AppInner wraps <BrowserRouter> สำหรับ /purchase/* routes
pages/
  WithholdingTaxPage.jsx # หน้าเดียวที่แยกไฟล์ (มี DEFAULT_PAYER info)
```

### Docker volumes
- `sales_pgdata` — PostgreSQL data
- `uploads_data` → mount `/app/uploads` — เก็บไฟล์ staff docs + PO docs
  - `/app/uploads/documents/` — staff documents
  - `/app/uploads/po/{po_id}/` — PO documents

---

## 🎨 3. Style Rules (สำคัญมาก!)

**ห้ามสร้าง style object ใหม่** — ให้ใช้ `styles` object ที่มีอยู่แล้ว (บรรทัด 7)

### Keys ที่มีใน styles
```javascript
// Layout
styles.layout, styles.sidebar, styles.main
styles.pageHeader, styles.pageTitle
styles.card          // กล่องขาว มุมโค้ง เงาเบา - ใช้เป็น wrapper หลัก

// Typography & color theme
// primary color: #1e3a5f (navy)
// pink accent (PO PDF): #c41556

// Form
styles.label, styles.input, styles.inputGroup
styles.formGrid      // grid 2 columns
styles.error, styles.success

// Buttons
styles.btn('primary')   // navy #1e3a5f
styles.btn('danger')    // red #dc2626
styles.btn('success')   // green #059669
styles.btn()            // default gray

// Badges
styles.badge('green')   // ecfdf5 / 059669
styles.badge('red')     // fef2f2 / dc2626
styles.badge('blue')    // eff6ff / 2563eb
styles.badge()          // default gray

// Table
styles.table, styles.th, styles.td
styles.trHover
styles.searchBar, styles.searchInput

// Modal
styles.overlay       // fixed full-screen bg
styles.modal         // white card, maxWidth 560 by default
styles.modalHeader, styles.modalBody, styles.modalFooter
styles.modalTitle

// Tabs
styles.tabs, styles.tab(active)

// Detail page
styles.detailHeader, styles.detailAvatar, styles.detailName, styles.detailSub

// Stats cards
styles.statsRow, styles.statCard, styles.statValue, styles.statLabel
```

### ❌ ห้ามทำ
- `<div style={styles.page}>` ← ไม่มี! ใช้ `<div>` plain แล้วใส่ `styles.pageHeader` ข้างใน
- สร้าง style object ของตัวเองในไฟล์ใหม่
- ใช้สีอื่นนอกจาก theme (navy `#1e3a5f`, red `#dc2626`, green `#059669`, blue `#2563eb`, pink `#c41556` เฉพาะ PO)

### ✅ Pattern ที่ถูก
```jsx
<div>
  <div style={styles.pageHeader}>
    <div style={styles.pageTitle}>ชื่อหน้า</div>
    <button style={styles.btn('primary')}>+ เพิ่ม</button>
  </div>
  <div style={styles.card}>
    <table style={styles.table}>
      <thead><tr><th style={styles.th}>...</th></tr></thead>
      <tbody>
        <tr><td style={styles.td}>...</td></tr>
      </tbody>
    </table>
  </div>
</div>
```

---

## 🎭 4. Modal Rules (สำคัญ!)

**Modal ฟอร์ม (มีการกรอกข้อมูล) ต้องไม่ปิดเมื่อคลิก overlay** — ป้องกันเสียข้อมูล

### Pattern ที่ถูก — Form modal (ล็อค)
```jsx
<div style={styles.overlay}>
  <div style={styles.modal} onClick={e => e.stopPropagation()}>
    {/* form */}
  </div>
</div>
```
ปิดด้วยปุ่ม **✕** + **ยกเลิก** เท่านั้น

### Pattern ที่ถูก — View modal (ปิดด้วย overlay ได้)
```jsx
<div style={styles.overlay} onClick={onClose}>
  <div style={styles.modal} onClick={e => e.stopPropagation()}>
    {/* view */}
  </div>
</div>
```

### สรุป
- **Form modals** (CreateStaff, CreateUser, ProductForm, SupplierForm, POForm, AddSerial, ฯลฯ) → **ไม่มี** `onClick={onClose}` บน overlay
- **View modals** (ProductDetail, PODetail) → **มี** `onClick={onClose}` บน overlay

---

## 🔧 5. Backend Pattern

### Import pattern
```javascript
const express = require('express');
const { query, getClient } = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const router = express.Router();
```

### Simple query
```javascript
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM table WHERE id = $1', [id]);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /path error:', err);
    res.status(500).json({ error: err.message });
  }
});
```

### Transaction pattern
```javascript
router.post('/', authenticate, async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    // ...
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
```

### File upload pattern (multer)
```javascript
const multer = require('multer');
const uploadDir = '/app/uploads/xxx';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}_${name}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 }, fileFilter: ... });

router.post('/:id/documents', authenticate, upload.single('file'), async (req, res) => {
  // req.file.originalname, req.file.filename, req.file.size, req.file.mimetype
});
```

### PDF generation patterns

**ระบบนี้มี 2 รูปแบบ ขึ้นอยู่กับเนื้อหาภาษาไทย:**

| Library | ใช้ตอนไหน | เหตุผล |
|---|---|---|
| **WeasyPrint** | PO PDF (เอกสารภาษาไทยเยอะ) | จัด vowel/tone mark ถูกต้อง 100% (ใช้ Pango+HarfBuzz) |
| **reportlab** | Withholding tax PDF (form ราชการ) | template form เป็นภาษาอังกฤษ + ตำแหน่งฟิกซ์ |

**⚠️ ห้ามใช้ reportlab สำหรับเอกสาร text-heavy ภาษาไทย** เพราะ `canvas.drawString()` ไม่จัด GPOS → สระ/วรรณยุกต์ลอย/ซ้อน (ดู 10.12)

**Backend invocation (เหมือนกันทั้ง 2 library):**
```javascript
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

router.get('/:id/pdf', authenticate, async (req, res) => {
  const pdfData = { /* ...data to pass to python... */ };
  const tmpFile = path.join(os.tmpdir(), `xxx_${Date.now()}.pdf`);
  const scriptPath = path.join(__dirname, '..', 'utils', 'generate_xxx.py');
  const tmpJson = tmpFile + '.json';
  fs.writeFileSync(tmpJson, JSON.stringify(pdfData));
  execSync(`cat "${tmpJson}" | python3 "${scriptPath}" "${tmpFile}"`);
  fs.unlinkSync(tmpJson);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="xxx.pdf"`);
  const stream = fs.createReadStream(tmpFile);
  stream.pipe(res);
  stream.on('end', () => fs.unlink(tmpFile, () => {}));
});
```

**WeasyPrint Python pattern (HTML→PDF):**
```python
from weasyprint import HTML
from weasyprint.text.fonts import FontConfiguration

html_content = f'''<!DOCTYPE html>
<html lang="th"><head><meta charset="UTF-8">
<style>
  @font-face {{ font-family: 'Sarabun'; src: url('file://{FONT_REG}'); }}
  body {{ font-family: 'Sarabun'; font-size: 9pt; }}
</style></head>
<body>...</body></html>'''

font_config = FontConfiguration()
HTML(string=html_content).write_pdf(out_path, font_config=font_config)
```

**Dockerfile dependencies (Debian — ห้ามใช้ Alpine):**
```dockerfile
FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip \
    libpango-1.0-0 libpangoft2-1.0-0 libcairo2 \
    libgdk-pixbuf-2.0-0 libharfbuzz0b libffi-dev \
    shared-mime-info fonts-thai-tlwg \
    && rm -rf /var/lib/apt/lists/*
RUN pip3 install --no-cache-dir --break-system-packages reportlab weasyprint
```

### ⚠️ Register route ใน `index.js`
หลังเพิ่ม route ใหม่ ต้อง:
1. `const xxxRoutes = require('./routes/xxx');` (บนสุด)
2. `app.use('/api/xxx', xxxRoutes);` (ใน block routes)
3. Rebuild: `docker compose up -d --build sales-api`

---

## 🔐 6. Frontend Pattern

### Authentication
```javascript
// มี helper ใน App.jsx บรรทัดแรก:
const authHeaders = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });

// วิธีใช้:
fetch('/api/xxx', { headers: authHeaders() })
fetch('/api/xxx', {
  method: 'POST',
  headers: { ...authHeaders(), 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})

// สำหรับ <a href> / window.open — ใช้ ?t= query string
<a href={`/api/xxx?t=${localStorage.getItem('token')}`}>...
window.open(`/api/xxx?t=${localStorage.getItem('token')}`, '_blank')
// (middleware/auth.js รองรับทั้งสองแบบ)
```

### File upload from React
```javascript
const uploadFile = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`/api/xxx/upload`, {
    method: 'POST', headers: authHeaders(),  // ไม่ต้องใส่ Content-Type
    body: fd
  });
};
```

### Component pattern
- ใช้ `React.useState`, `React.useEffect`, `React.useRef` (ไม่ import hook แยก)
- Modal: parent เก็บ state `showXxx` + `editXxx` → pass เป็น prop
- Response check: `setData(Array.isArray(d) ? d : [])` กันกรณี error

---

## 🗄️ 7. Database Schema

### ต้องรู้ชื่อ column ให้ตรง! (โปรเจคนี้ naming ไม่สม่ำเสมอ)

**`purchase_orders`** — มี column เยอะสุด
```
# เดิม
supplier_id (→ suppliers, ไม่ใช่ vendor_id)
po_date (ไม่ใช่ order_date)
total_amount (ไม่ใช่ subtotal)
grand_total (ไม่ใช่ total)
notes (ไม่ใช่ note)
status: 'draft' | 'approved' | 'received' | 'cancelled' (ไม่ใช่ 'pending')
vat_rate, vat_amount
approved_by, approved_at, received_by, received_at

# เพิ่ม 2026-04-24 (migration_po_billing_payment.sql)
ordered_by_staff_id (→ staff)  # ผู้สั่งซื้อ
job_name VARCHAR(200)           # ชื่องาน
credit_days INTEGER             # เครดิต (วัน)
due_date DATE                   # ครบกำหนด (auto-calc po_date + credit_days)
wht_rate NUMERIC(5,2)           # ⚠️ DEPRECATED 2026-04-25 evening (set = 0 เสมอ; ใช้ po_items.wht_rate แทน)
wht_amount NUMERIC(15,2)        # ยอดหัก ณ ที่จ่าย (sum จาก po_items.wht_amount)

bill_number VARCHAR(50)         # เลขใบวางบิลจาก supplier
bill_date DATE
bill_notes TEXT

payment_status VARCHAR(20)      # 'unpaid' | 'paid' | 'partial'
payment_date DATE
payment_method VARCHAR(20)      # 'cash' | 'transfer' | 'cheque'
payment_reference VARCHAR(100)
payment_amount NUMERIC(15,2)
payment_notes TEXT

withholding_id (→ withholding_tax) # link ไปใบหัก ณ ที่จ่ายที่สร้าง
```

**`po_items`**
```
quantity (ไม่ใช่ qty)
total_price (ไม่ใช่ subtotal)
received_qty
unit
unit_price
description TEXT          # ใหม่ 2026-04-25 — รายละเอียดเพิ่มเติมรายตัว
wht_rate NUMERIC(5,2)     # ใหม่ 2026-04-25 evening — % หัก ณ ที่จ่าย รายตัว
wht_amount NUMERIC(15,2)  # ใหม่ 2026-04-25 evening — total_price × wht_rate / 100
income_type VARCHAR(50)   # ใหม่ 2026-04-26 (Phase 2.9) — ประเภทเงินได้ (40(1)/40(2)/ม.3 เตรส/...)
pnd_form VARCHAR(20)      # ใหม่ 2026-04-27 (Phase B2) — แบบ ภ.ง.ด. (ภ.ง.ด.3/53/...)
# Index: idx_po_items_income_type, idx_po_items_pnd_form (partial WHERE NOT NULL)
```

**`po_documents`** (ใหม่ 2026-04-24, ขยาย 2026-04-26)
```
po_id (→ purchase_orders, ON DELETE CASCADE)
file_name VARCHAR(255)      # ชื่อไฟล์ดั้งเดิม
file_path VARCHAR(500)      # ชื่อไฟล์บน disk (timestamp_basename.ext)
mime_type VARCHAR(100)
file_size INTEGER
notes VARCHAR(500)
doc_type VARCHAR(20)        # ใหม่ Phase 2.8 — 'general' | 'slip' (ใบโอน)
uploaded_by (→ users)
uploaded_at
# ไฟล์จริงเก็บที่ /app/uploads/po/{po_id}/
# Slip filtering: GET /api/purchase-orders/:id/documents?type=slip
```

**`products`**
```
product_code (ไม่ใช่ code)
default_unit (ไม่ใช่ unit)
product_type: 'service' | 'non_stock' | 'stock'
  * service  : บริการ (ไม่นับ stock, ไม่มี serial) → PO บริการ auto-receive
  * non_stock: สินค้าเหมา (นับ stock, ไม่มี serial)
  * stock    : สินค้านับสต็อก (นับ stock + มี serial)
model
brand                                                       # ใหม่ Phase 2.14 — ยี่ห้อ
cost_price  ← ราคาอ้างอิง (default ตอนสร้าง PO) สำหรับ service/non_stock
sell_price
stock_qty   ⚠️ อาจเป็น NaN — ต้อง guard ด้วย:
  CASE WHEN stock_qty IS NULL OR stock_qty::text = 'NaN' THEN 0 ELSE stock_qty END
```

**`product_serials`**
```
serial_no, mac_address
status: 'available' | 'sold' | 'reserved'
po_id (→ purchase_orders) ← ผูกกับ PO ที่ซื้อมา
cost_price ← ต้นทุนต่อชิ้น (ใช้ของ po_items.unit_price ตอนรับ)
notes
```

**`suppliers`** (ไม่ใช่ `vendors`!)
```
code, name, contact_person, phone, email, address, tax_id
```

**`product_categories`**
```
name, code (auto: CAT-001), description, is_active
```

**`product_images`** (ใหม่ Phase 2.14 — 2026-05-03)
```
product_id (→ products, ON DELETE CASCADE)
file_name VARCHAR(255)          # ชื่อไฟล์ดั้งเดิม
file_path VARCHAR(500)          # ชื่อไฟล์บน disk (timestamp_basename.ext)
mime_type VARCHAR(100)
file_size INTEGER
is_cover BOOLEAN DEFAULT FALSE  # รูปหลัก (1 product = 1 cover)
display_order INTEGER DEFAULT 0
uploaded_by (→ users, ON DELETE SET NULL)
uploaded_at TIMESTAMPTZ DEFAULT NOW()
# Indexes:
#   uq_product_images_one_cover  UNIQUE (product_id) WHERE is_cover = TRUE
#   idx_product_images_product_id
# ไฟล์จริงเก็บที่ /app/uploads/products/{product_id}/
# Limit: max 5 รูป/สินค้า, 5MB/รูป, .jpg/.png/.webp (enforce ใน backend)
```

**`withholding_tax`** + **`withholding_tax_items`**
```
withholding_tax:
  doc_no (unique, format WHT{YYYY}{MM}{NNNN})
  tax_year, issue_date
  payer_name, payer_tax_id, payer_address  # เรา (IDEA HOUSE)
  payee_name, payee_tax_id, payee_address  # supplier
  pnd_form (ภ.ง.ด.3, 53, ฯลฯ), pnd_seq
  income_type ('ม.3 เตรส', '40(1)', ฯลฯ), income_desc
  total_income, total_tax
  withhold_method, tax_words
  status ('draft' | 'issued' | 'cancelled')
  staff_id (optional), created_by
  source_po_id (→ purchase_orders) # ใหม่ Phase 2.9 — link 1 PO → many WHT
                                    # ใช้ group by ใน cancel/list
withholding_tax_items:
  pay_date, description
  income_amount, tax_amount
  pnd_form, income_type            # per-item (ใช้ render PDF rายตัว Phase B1)
```

**`company_bank_accounts`** (ใหม่ Phase 2.8 — 2026-04-26)
```
bank_name VARCHAR(100)        # 'กสิกรไทย', 'กรุงเทพ', etc.
branch VARCHAR(100)
account_no VARCHAR(50)
account_name VARCHAR(200)
bank_account_type VARCHAR(50) # 'บัญชีออมทรัพย์' | 'บัญชีกระแสรายวัน'
display_order INTEGER         # ลำดับแสดงใน Pay Modal
notes TEXT
is_active BOOLEAN DEFAULT TRUE
created_at, updated_at
```

**`staff_documents`** (pattern reference — ใช้แบบเดียวกันกับ po_documents)

**`customers`** (ใหม่ Phase 3.1 — 2026-05-03)
```
customer_code VARCHAR(30) UNIQUE  # auto: CUS-0001 (sequence customer_code_seq)
name          VARCHAR(255) NOT NULL
tax_id        VARCHAR(20)         # UNIQUE (partial WHERE NOT NULL/empty)
branch        VARCHAR(50)         # 'สำนักงานใหญ่' | '00001' | ...
address       TEXT
postal_code   VARCHAR(10)
phone, email, notes
is_active     BOOLEAN DEFAULT TRUE
created_by    (→ users, ON DELETE SET NULL)
created_at, updated_at
# Indexes: idx_customers_name, idx_customers_is_active, uq_customers_tax_id (partial)
```

**`customer_contacts`** (ใหม่ Phase 3.1 — 2026-05-03)
```
customer_id   (→ customers, ON DELETE CASCADE)
name          VARCHAR(200) NOT NULL  # ผู้ประสานงาน
position      VARCHAR(100)
phone, email, line_id
is_primary    BOOLEAN DEFAULT FALSE  # contact หลัก (1 ต่อ customer)
display_order INTEGER DEFAULT 0
notes
# Indexes: idx_customer_contacts_customer_id
#         uq_customer_contacts_one_primary UNIQUE (customer_id) WHERE is_primary = TRUE
# Auto rules (backend):
#   - contact แรกของ customer → is_primary = TRUE auto
#   - ลบ primary → ตั้ง contact ที่เหลือตัวแรกเป็น primary auto
```

**`customer_documents`** (ใหม่ Phase 3.1.1 — 2026-05-03)
```
customer_id   (→ customers, ON DELETE CASCADE)
file_name VARCHAR(255)        # ชื่อไฟล์ดั้งเดิม
file_path VARCHAR(500)        # ชื่อไฟล์บน disk (timestamp_basename.ext)
mime_type, file_size, notes
uploaded_by   (→ users, ON DELETE SET NULL)
uploaded_at
# ไฟล์จริงเก็บที่ /app/uploads/customers/{customer_id}/
# Limit: 20MB/ไฟล์, .pdf/.jpg/.png/.doc/.docx/.xls/.xlsx
# ไม่มี doc_type — ใช้ notes อธิบายแทน
```

---


### Enum Values (สำคัญ — ห้ามเดา query ก่อน)

```sql
-- staff_salary.employee_type
'monthly'    -- รายเดือน (default)
'daily'      -- รายวัน
'contract'   -- รายสัญญาจ้าง / จ้างเหมา

-- payroll.status
'draft'      -- ร่าง (แก้ไขได้)
'approved'   -- อนุมัติแล้ว (ต้องยกเลิกอนุมัติก่อน → กลับเป็น draft)

-- purchase_orders.status
'draft' | 'approved' | 'received' | 'cancelled'

-- purchase_orders.payment_status
'unpaid'    -- ยังไม่ชำระ (default)
'paid'      -- ชำระแล้ว
-- ⚠️ ไม่มี 'partial' (เคยเดาผิดแล้วต้องแก้รอบ 2 — เจอ 2026-04-30)
```

**ทุกครั้งที่จะ filter/group ตาม column enum:**
```bash
docker compose exec -T sales-db psql -U sales_admin -d sales_system -c \
  "SELECT column_name, COUNT(*) FROM table_name GROUP BY column_name ORDER BY 2 DESC;"
```

**บทเรียน Phase 2.10:** ผม assume ว่า `employee_type` มีแค่ `monthly`/`daily` แต่จริงๆ มี `contract` ด้วย → รายงานเงินเดือนไม่แยกกลุ่มถูกต้อง → ต้องแก้รอบ 2

## 🧮 8. Business Logic ที่ตกลงไว้

### ต้นทุนสินค้า (Cost)
- **service / non_stock**: ใช้ `products.cost_price` (คงที่)
- **stock**: คำนวณ **AVG จาก `product_serials.cost_price`** ของ serial `available`
- คำนวณใน SQL (มี alias `avg_cost` ส่งกลับจาก GET /products):
```sql
CASE
  WHEN p.product_type = 'stock' THEN
    COALESCE(
      (SELECT AVG(cost_price) FROM product_serials
       WHERE product_id = p.id AND status = 'available' AND cost_price > 0),
      p.cost_price, 0
    )
  ELSE p.cost_price
END AS avg_cost
```
- **Frontend** แสดง 2 ตำแหน่งทศนิยม:
  `Number(p.avg_cost || p.cost_price || 0).toLocaleString("th-TH", {minimumFractionDigits: 2, maximumFractionDigits: 2})`

### Purchase Order Flow
```
1. สร้าง PO (status = 'draft')
2. อนุมัติ (POST /:id/approve)
   - ถ้า PO มี item ที่ไม่ใช่ service → 'approved' → ต้องกดรับสินค้า
   - ถ้า PO มีแต่ service → 'received' ทันที (auto-received) ⭐
3. รับสินค้า (POST /:id/receive)
   - บันทึก Serial (ถ้า stock) พร้อม po_id และ cost_price จาก unit_price
```
- รับทีเดียว ไม่รับทยอย
- PO number: `PO{YYYY}{MM}{NNNN}` (running reset ทุกเดือน)
- Serial ต้อง unique ต่อสินค้า (serial บังคับ, MAC optional)
- ปุ่มอนุมัติ/รับสินค้า กดจาก list หรือ detail ก็ได้

### PO Billing/Payment Flow
```
สร้าง PO (credit_days, wht_rate กรอกตอนสร้าง)
  ↓
ได้ใบวางบิล → PUT /:id/billing (bill_number, bill_date, bill_notes)
  ↓
จ่ายเงิน → PUT /:id/payment (method, date, reference, amount)
  ↓
ถ้ามี wht_rate > 0 → POST /:id/withholding (สร้างใบหัก ณ ที่จ่าย)
```
- Auto-calc `due_date` = `bill_date + credit_days`
- `withholding_id` ใน PO link กลับไปใบหัก ณ ที่จ่ายที่สร้าง
- สร้างใบหัก ณ ที่จ่ายได้ **ครั้งเดียวต่อ PO**

### VAT / WHT
- PO มี VAT toggle 7% / ไม่มี VAT
- **หัก ณ ที่จ่าย: ระดับรายการ (per-item)** ⭐ ตั้งแต่ 2026-04-25 evening
  - แต่ละ item เลือก % ของตัวเองได้: 0/1/2/3/5/10/15
  - `po_items.wht_amount` = `quantity × unit_price × wht_rate / 100`
  - `purchase_orders.wht_amount` = sum ของ `po_items.wht_amount`
  - PDF: column "หัก" แสดงแค่ % รายตัว, footer แสดง "หัก ณ ที่จ่าย" + "ยอดชำระ" รวม

### เอกสารแนบ PO
- แนบได้ทุกสถานะ (draft/approved/received)
- รองรับ PDF, JPG, PNG, DOC/DOCX, XLS/XLSX
- Max 20 MB/ไฟล์
- เก็บที่ `/app/uploads/po/{po_id}/{timestamp}_{filename}`
- ลบ PO → เอกสารหายตาม (CASCADE + file unlink)

---

## 🛠️ 9. วิธี Deploy การเปลี่ยน Code

### Backend เท่านั้น
```bash
cd /home/IDEA-HOUSE/sales-system
docker compose up -d --build sales-api
docker compose logs sales-api --tail=10   # ต้องเห็น "Sales API running on port 4000"
```

### Frontend เท่านั้น
```bash
docker compose up -d --build sales-web
```

### ทั้งคู่
```bash
docker compose up -d --build sales-api sales-web
```

### Force rebuild (ถ้า cache งอแง)
```bash
docker compose down
docker rmi sales-system-sales-api sales-system-sales-web
docker compose up -d --build
```

### รัน Migration SQL
```bash
# วิธีที่ 1: ไฟล์ .sql ที่อยู่ใน project root
docker compose exec -T sales-db psql -U sales_admin -d sales_system < migration_xxx.sql

# วิธีที่ 2: heredoc inline
docker compose exec -T sales-db psql -U sales_admin -d sales_system << 'EOF'
ALTER TABLE xxx ADD COLUMN IF NOT EXISTS yyy ...;
EOF
```

### Patch ด้วย Python script (safer than sed สำหรับ code blocks ใหญ่)
ถ้า block ที่จะแก้เป็น multi-line + มี backtick/special chars → ใช้ Python:
```python
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
OLD = """...exact block..."""
NEW = """...replacement..."""
if OLD in content:
    content = content.replace(OLD, NEW)
# หรือถ้า whitespace ไม่ match ได้ — ใช้ line-based:
# 1. หา anchor line ด้วย .startswith() หรือ 'X' in line
# 2. insert/replace ด้วย index
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
```

---

## ⚠️ 10. กับดักที่เจอบ่อย (ต้องระวัง!)

### 10.1 Docker build cache ไม่ refresh source
**อาการ:** แก้ code แล้วไม่เห็นผล, response JSON ยังเป็นของเก่า
**แก้:** `docker rmi sales-system-sales-api` ก่อน build ใหม่

### 10.2 ไฟล์ใน `routes/` มี 2 naming conventions
- `purchaseOrders.js` (camelCase)
- `product-categories.js` (dash)
- `staffDetail.js` (camelCase)
- **ต้องดู `index.js` ก่อนว่าเรียกไฟล์ชื่ออะไร** — `grep "require" backend/src/index.js`

### 10.3 PostgreSQL NaN
- `COALESCE(col, 0)` **ไม่ catch** NaN (เพราะ NaN ≠ NULL)
- ต้องใช้ `CASE WHEN col IS NULL OR col::text = 'NaN' THEN 0 ELSE col END`

### 10.4 sed delimiter ชน
- ถ้า replace มี `|` ใน content → ใช้ `#` หรือ `@` เป็น delimiter
- ถ้ามี single quote → escape เป็น `'\''`
- **ถ้าแก้ code หลายบรรทัดซ้อน → ใช้ Python script ดีกว่า sed มาก**

### 10.5 docker compose exec ต้องใช้ `-T` เสมอเมื่อ pipe heredoc
```bash
docker compose exec -T sales-db psql ... << 'EOF'   # ✅
docker compose exec sales-db psql ... << 'EOF'      # ❌ TTY error
```

### 10.6 Python patch script — OLD block ต้องตรงเป๊ะ
- Whitespace, indentation, line endings (CRLF vs LF) ต้องเหมือนต้นฉบับ 100%
- ถ้า `if OLD in content` คืน False → ตรวจว่า pattern ตรงไหม
- **Tip:** ใช้ line-based approach เมื่อ block-based ไม่ตรง

### 10.7 `authHeaders()` ต้องมีในบรรทัดแรกของ `App.jsx`
ถ้าหาย → frontend ขึ้นหน้าขาว + console error `authHeaders is not defined`

### 10.8 Backend ตอบ "No token provided" ตอน test curl
- Login ก่อน: `admin / admin8585!`
- หรือใช้ token จาก browser: F12 → Console → `localStorage.getItem('token')`
- **auth.js รองรับ token ใน query string `?t=xxx`** (สำหรับ `<a href>` และ `window.open`)

### 10.9 Modal ปิดตอนคลิกนอกกรอบตอนกรอก (แก้แล้ว commit 5bcc3ae)
- Form modal ต้อง**ไม่มี** `onClick={onClose}` บน overlay
- View modal (Detail) เท่านั้นที่มีได้

### 10.10 Patch overlap หลาย component (เจอใน session 04-24)
- ระวัง block ใน Component A เหมือน block ใน Component B
- ตรวจ scope ด้วย `awk 'NR<=LINE && /^function /'`
- ก่อนใช้ replace → เช็คว่า pattern นี้มีครั้งเดียวในไฟล์

### 10.11 HTTP Method mismatch — บั๊กเงียบ (เจอใน session 04-25)
**อาการ:** กดปุ่ม Save แล้วเงียบ — ไม่มี error ใน Console, ไม่มี popup, ฟอร์มไม่ปิด
**Root cause:** Frontend ส่ง method หนึ่ง (เช่น PUT) แต่ Backend register อีก method (PATCH)
- Express ตอบ 404 + HTML page (`<!DOCTYPE...`)
- Frontend `JSON.parse()` พัง → throw `SyntaxError: Unexpected token '<'`
- ถ้า frontend ไม่ catch error สวย ๆ → ผู้ใช้ไม่เห็นอะไรเลย

**วิธี debug:**
1. F12 → **Network tab** → กด Save → ดู status code (มักเป็น 404 สีแดง)
2. F12 → **Console** อาจเงียบหรือมี `Unexpected token '<'`
3. `docker compose logs sales-api --tail=20` → ดูว่า request เข้ามาด้วย method อะไร

**Convention ของระบบนี้:** ทุก module ใช้ `PUT /:id` สำหรับ update
- ❌ ยกเว้น `withholdingTax` ที่ใช้ `PATCH /:id` (frontend ส่ง PATCH ตรงกัน — ไม่ผิด)
- ✅ `suppliers` รองรับทั้ง `PATCH` และ `PUT` (alias ชี้ handler เดียวกัน)

**Pattern แก้ — ใช้ shared handler กัน duplicate code:**
```javascript
const updateXxx = async (req, res) => { /* logic */ };
router.patch('/:id', authenticate, updateXxx);
router.put('/:id', authenticate, updateXxx);
```

**ก่อน register route ใหม่ — เช็ค method ทั้งสองฝั่งให้ตรงกัน:**
```bash
# Backend
grep -n "router\.\(get\|post\|put\|patch\|delete\)" backend/src/routes/xxx.js

# Frontend
grep -rn "method.*['\"]PUT\|PATCH['\"]" frontend/src/
```

### 10.12 reportlab ไม่จัด Thai vowel/tone positioning (เจอ 2026-04-25)
**อาการ:** ใช้ `canvas.drawString()` ใน reportlab → สระอิ/อี/อึ/อือ + วรรณยุกต์ ลอยห่าง / ซ้อนกัน

**Root cause:** reportlab ไม่รองรับ **OpenType GPOS** (Glyph Positioning) → ไม่ honor mark positioning ของ Thai font

**สิ่งที่ลองแล้ว — ❌ ไม่ work:**
1. ❌ ใช้ `Paragraph` แทน `drawString` — ไม่ช่วย
2. ❌ ใหญ่ font เป็น 14-32pt — ลดอาการแต่ไม่หาย
3. ❌ เปลี่ยน font: Sarabun → THSarabunNew → Noto Sans Thai
4. ❌ ใช้ `fix_thai_vowels()` (PHP port from [dtinth/716814](https://gist.github.com/dtinth/716814)) — Sarabun (Google Fonts) ไม่มี PUA glyphs → สระหายเลย

**✅ Solution: เปลี่ยนเป็น WeasyPrint**
- WeasyPrint ใช้ Pango + HarfBuzz (text shaping engine) → จัด Thai ถูกต้อง 100%
- เขียน layout เป็น HTML/CSS แทน canvas (แก้ง่ายกว่า)
- ต้องเปลี่ยน Dockerfile base: `node:20-alpine` → `node:20-slim` (Alpine ลง weasyprint dependencies ยุ่ง)
- ต้องเพิ่ม system deps: pango/cairo/gdk-pixbuf/harfbuzz/fonts-thai-tlwg
- Build image นานขึ้น ~2x (ลง dependencies เยอะ) — ยอมแลกได้

**สำหรับ withholding tax PDF (form ราชการ) ยังใช้ reportlab ได้** เพราะ form template ไม่มี text Thai เยอะ ตำแหน่งฟิกซ์อยู่แล้ว

---

### 10.13 Python patch script — indentation ในไฟล์จริงต้องตรงเป๊ะ (เจอ 2026-04-25)
**อาการ:** patch script รันแล้วบอก `✗ NOT FOUND` ทุก pattern แต่ duplicate-check ก็ผ่าน

**Root cause:** ไฟล์จริงใน VM **indentation ไม่เหมือน convention** ที่คาดเดา เช่น:
- React.useState `const [items, setItems] = ...` ใน App.jsx **ไม่มี leading spaces** (ที่ผมเขียน script คาดว่ามี 2 spaces)
- Patch script `replacements` array ใช้ string match แบบ exact → space ผิด 1 ตัวก็ไม่ match

**วิธี debug:**
```bash
# ดูบรรทัดจริงพร้อมเลขบรรทัด
grep -n "useState.*product_id" frontend/src/App.jsx

# ใช้ -- หน้าบรรทัดที่ขึ้นต้นด้วย dash เผื่อ shell mistake parse
sed -n '2400,2415p' frontend/src/App.jsx | cat -A   # cat -A แสดง $ จบบรรทัด, ^I เป็น tab
```

**Pattern แก้:**
1. **อ่านไฟล์จริงก่อนเขียน patch** — ใช้ `sed -n 'START,ENDp'` ดู context รอบๆ
2. **เขียน OLD block ให้ตรง byte-for-byte** รวม leading whitespace
3. **ทดสอบ patch ด้วย dry run** — ใส่ assertion ว่า count > 0 ก่อน save file
4. **ถ้าหา pattern ไม่เจอ — print first 100 chars ของ pattern ออกมา** เพื่อเทียบกับไฟล์จริง

**Best practice:** ทุก patch script ของระบบนี้ต้อง print "✓" หรือ "✗ NOT FOUND" ของแต่ละ replacement แล้ว exit non-zero ถ้าไม่ครบ

---

### 10.14 TRUNCATE CASCADE ลามไปลบ table ที่ไม่ได้ตั้งใจ (เจอ 2026-04-27)
**อาการ:** รัน `TRUNCATE staff RESTART IDENTITY CASCADE` เพื่อล้าง test data — แต่ NOTICE บอก `truncate cascades to table "users"` → users หายหมด → login ไม่ได้

**Root cause:** PostgreSQL `TRUNCATE ... CASCADE` keyword **ลบทุก table ที่ FK references** ไปยัง table ที่ truncate **ไม่ว่า constraint จะตั้ง ON DELETE CASCADE หรือไม่**
- FK `users.staff_id → staff` (default `NO ACTION` ตอน DELETE)
- แต่ `TRUNCATE staff CASCADE` ลามไป users ทันที

**วิธีถูก:**
```sql
-- 1. Break FK ก่อน
UPDATE users SET staff_id = NULL WHERE staff_id IS NOT NULL;

-- 2. TRUNCATE ไม่ใส่ CASCADE — จะ error ถ้ามี FK ไม่ได้ break
TRUNCATE staff RESTART IDENTITY;
```

หรือใช้ `DELETE FROM` ที่ตามลำดับ child→parent (เคารพ ON DELETE NO ACTION)

**Best practice:** ก่อน TRUNCATE/DELETE bulk:
```sql
-- ดู FK ทุก reference
SELECT conname, conrelid::regclass FROM pg_constraint
WHERE contype='f' AND confrelid='target_table'::regclass;
```

---

### 10.15 react-router-dom hybrid migration (เจอ 2026-04-27)
**บริบท:** ย้าย POForm จาก Modal → Page ต้องใช้ URL routing — แต่ App มี 10+ หน้า state-based อยู่แล้ว → ไม่อยาก refactor ทุกหน้าทีเดียว

**Pattern ที่ใช้:**
```jsx
function App() {
  return <BrowserRouter><AppInner /></BrowserRouter>;
}

function AppInner() {
  const [page, setPage] = useState('dashboard');  // state-based เก่ายังอยู่
  // ... auth, sidebar
  return (
    <Routes>
      <Route path="/purchase" element={<PurchaseOrderPage />} />
      <Route path="/purchase/new" element={<POFormPage />} />
      <Route path="/purchase/:id" element={<PODetailPage />} />
      <Route path="/purchase/:id/edit" element={<POFormPage />} />
      <Route path="*" element={  // catch-all สำหรับหน้าเก่า
        <>
          {page === 'dashboard' && <DashboardPage />}
          {page === 'staff' && <StaffListPage />}
          ...
        </>
      } />
    </Routes>
  );
}
```

**Sidebar onClick logic:**
- เมนู `purchase` → `navigate('/purchase')`
- เมนูอื่น → ถ้าอยู่ใน `/purchase/*` → navigate('/') ก่อน, แล้ว setPage(...)
- Active highlight: ใช้ `useLocation().pathname.startsWith('/purchase')` สำหรับ purchase, อย่างอื่นใช้ `page === item.key`

**Note:** nginx.conf ต้องมี `try_files $uri $uri/ /index.html` (มีแล้วใน sales-web)

---

### 10.16 Multi-page PDF refactor pattern (เจอ 2026-04-27)
**บริบท:** PDF generator เดิมรับ data → วาด 1 หน้า → save. ต้อง refactor ให้รับ items[] หลาย row → 1 PDF หลายหน้า (1 row = 1 หน้า)

**Pattern:**
```python
def render_page(c, d):
    """วาด 1 หน้าบน canvas — caller จัดการ canvas + showPage/save"""
    # ...code วาดเดิม (ไม่มี c.save())

def generate(fname, d):
    """1 row = 1 หน้า PDF"""
    c = canvas.Canvas(fname, pagesize=A4)
    items = d.get('items', [])
    if not items:
        render_page(c, d); c.save(); return
    for idx, item in enumerate(items):
        page_d = dict(d)  # shallow copy header
        page_d['items'] = [item]  # only this row
        # override fields ที่ render ใช้ — pnd_form, income_type, totals
        page_d['pnd_form'] = item.get('pnd_form', d['pnd_form'])
        page_d['total_income'] = item['income_amount']
        page_d['total_tax'] = item['tax_amount']
        page_d['tax_words'] = num_to_thai_words(item['tax_amount'])
        render_page(c, page_d)
        if idx < len(items) - 1:
            c.showPage()
    c.save()
```

**Key insights:**
- แยก rendering pure (`render_page`) จาก orchestration (`generate`)
- Per-page data ใช้ `dict(d)` shallow copy + override field ที่ต้อง customize
- `c.showPage()` ระหว่างหน้า — ไม่ใส่หลัง row สุดท้าย (ไม่งั้นได้หน้าว่างท้ายไฟล์)

---

### 10.17 Patch script: pattern ต้อง paste จริงจาก grep, ห้ามจำ (เจอ 2026-04-27)
**อาการ:** Phase B2 patch_phase_b2_backend.py — POST/PUT INSERT pattern ผ่าน แต่ validation/group/loop ไม่ผ่าน

**Root cause:** เขียน OLD pattern จากความจำ — ของจริงต่าง:
- ผมจำว่า `const missingIncomeType = ... .some(...)` แต่จริง `const missingType = ... .find(...)`
- Response เป็น single-line `{ error: '...' }` แต่จริง multi-line + template literal:
  ```js
  return res.status(400).json({
    error: `รายการที่มีหัก ณ ที่จ่ายต้องระบุประเภทเงินได้ทุกตัว`
  });
  ```

**วิธีแก้ที่ใช้:**
1. ขอให้ user `sed -n 'START,ENDp'` paste context จริง 5-10 บรรทัดรอบ pattern
2. Copy text นั้น **ทั้งก้อน** ไปใส่ patch script (preserved indentation + newlines + backticks)
3. ใช้ Python triple-quoted string กัน escape hell

**Best practice:** **อย่าเขียน patch จากความทรงจำ** — ทุก pattern ต้องเริ่มจาก `grep -B 2 -A 5` หรือ `sed -n` ก่อนเสมอ
- ถ้า pattern มี backtick `` ` `` ใช้ Python `"""..."""` (triple double-quote) ไม่ต้อง escape
- ถ้า pattern มี `${var}` เก็บไว้ตามจริง — Python triple-string ไม่ interpret

---

### 10.18 Vite content hash อาจซ้ำเดิมแม้ source เปลี่ยน (เจอ 2026-04-30)
**อาการ:** แก้ `App.jsx` แล้ว rebuild เสร็จ แต่ไฟล์ output ยังชื่อเดิม (`index-XXXXXX.js` hash เดิมเป๊ะ) → ทำให้คิดว่า build ไม่ผ่าน → ไล่หา bug ใน Docker cache เป็นชั่วโมง

**Root cause:** Vite ใช้ content hash บน chunk ซึ่งบางครั้ง hash อาจ collide หรือ Vite normalize content คล้ายกันมากจนได้ hash เดิม → **ชื่อไฟล์เหมือนเดิม ≠ เนื้อหาเดิม**

**วิธีตรวจที่ถูก** — ดูเนื้อหาใน build ไม่ใช่ชื่อไฟล์:
```bash
# ❌ ผิด — เช็คแค่ชื่อไฟล์
docker compose exec sales-web ls /usr/share/nginx/html/assets/

# ✅ ถูก — grep string ที่เพิ่งเพิ่มเข้าไป
docker compose exec sales-web sh -c \
  'grep -oE "[ก-๛]+" /usr/share/nginx/html/assets/*.js | sort -u | grep "ครบกำหนด"'
```

**Browser cache เป็นปัญหาแยก:** ถ้า hash เดิมจริงๆ → browser จะใช้ cached JS โดยไม่ download ใหม่ → ต้อง **Ctrl+Shift+R** (hard refresh) หรือเปิด incognito

**บทเรียน:** ตรวจ 3 ชั้นต้องเช็ค "เนื้อหา" ไม่ใช่ "ชื่อ":
1. Disk: `grep ฯ frontend/src/App.jsx`
2. Container build: `grep ฯ /usr/share/nginx/html/assets/*.js`
3. Browser: hard refresh + DevTools Network tab

### 10.19 Server-side tree vs flat — frontend filter ไม่เห็น children (เจอ 2026-04-30)
**อาการ:** หน้า "หมวดหมู่" ไม่แสดงหมวดย่อย ทั้งที่ DB มี `parent_id` ครบ และ UI logic ดูถูก (`categories.filter(c => c.parent_id === parentId)`)

**Root cause:** Backend `GET /api/product-categories` default ส่ง **tree structure** (nested `children` array) — ไม่ใช่ flat list:
```json
[
  { id: 3, name: "สินค้า", parent_id: null, children: [
    { id: 5, name: "Sensor", parent_id: 3, children: [] },
    { id: 6, name: "Gateway", parent_id: 3, children: [] }
  ]}
]
```
→ `categories.filter(c => c.parent_id === 3)` คืน array ว่าง เพราะ Sensor/Gateway ฝังใน `children` ไม่ได้อยู่ใน root array

**วิธีแก้:** เรียก `?flat=1` (backend มี option นี้อยู่แล้วเพื่อ backward compat):
```js
fetch('/api/product-categories?flat=1', ...)
```

**บทเรียน:**
- ก่อนใช้ data จาก API → `console.log` หรือ DevTools Network tab ดู shape จริง
- Backend ที่มี option ทั้ง flat+tree → frontend ทุกที่ต้อง consistent ว่าจะใช้แบบไหน
- Future: ProductFormModal ใช้ tree ได้ (แสดง indent), แต่ filter logic ต้องใช้ flat

---

## 📝 11. Workflow การทำงาน (สไตล์ที่พี่ชอบ)

1. **อย่ากล้าเดา** schema หรือ style — ตรวจจาก code จริงก่อน
2. **ส่งไฟล์ครบให้ upload** ผ่าน WinSCP สำหรับไฟล์ใหม่หรือแก้ทั้งไฟล์
3. **ถ้าเปลี่ยนเล็ก**: Python script (หรือ `str_replace` สั้น ๆ) ปลอดภัยกว่า sed
4. **ภาษาไทยเสมอ** เรียกผู้ใช้ว่า "พี่"
5. **หน้าตา UI ต้องใช้ `styles` object เดิม** — ห้ามเดาสีเอง
6. **ถาม spec ให้ชัดก่อนลงมือ** โดยเฉพาะ business logic
7. **Commit แยก feature** — ไม่กอง commit ใหญ่ทีเดียว
8. **Backup ก่อนแก้ไฟล์ใหญ่:** `cp App.jsx App.jsx.bak`
9. **ทำ patch ทีละขั้น** — ทดสอบผ่านก่อนทำ step ต่อไป

---

## 🔍 12. คำสั่งเช็คสุขภาพระบบ

```bash
cd /home/IDEA-HOUSE/sales-system

# ดู container
docker compose ps

# ดู log backend
docker compose logs sales-api --tail=20

# เข้า DB ดู schema
docker compose exec -T sales-db psql -U sales_admin -d sales_system -c "\d purchase_orders"
docker compose exec -T sales-db psql -U sales_admin -d sales_system -c "\d products"
docker compose exec -T sales-db psql -U sales_admin -d sales_system -c "\d po_documents"

# เช็ค route ที่ mount
grep -n "app.use\|require.*routes" backend/src/index.js

# เช็ค style keys ที่มี
sed -n '7,100p' frontend/src/App.jsx

# ทดสอบ API (ต้อง login ก่อน)
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin8585!"}' | grep -oP '"token":"\K[^"]+')
curl -s http://localhost:4000/api/purchase-orders -H "Authorization: Bearer $TOKEN" | head -c 500
```

---

## 📍 13. Feature ที่ทำเสร็จแล้ว (เพื่อไม่ให้ทำซ้ำ)

### Phase 1
- ✅ Staff Management (CRUD + 7 tabs detail)
- ✅ Auto-generate employee code (EMP-XXX)
- ✅ Progressive tax 2569 + social security
- ✅ Document upload (3 categories, Docker volume)
- ✅ Payroll (monthly, OT/bonus/deductions, approval)
- ✅ User Management (role/permission grid)
- ✅ Withholding Tax + PDF (ภ.ง.ด.3, 53, ฯลฯ)

### Phase 2 — Stock & Purchase Order
- ✅ Stock Management (products + suppliers + categories)
- ✅ Product types: service / non_stock (สินค้าเหมา) / stock
- ✅ Purchase Order flow (draft → approved → received)
- ✅ PO number: `PO{YYYY}{MM}{NNNN}`
- ✅ VAT toggle 7% / ไม่มี VAT
- ✅ Serial/MAC ผูก PO ตอนรับสินค้า (serial บังคับ, MAC optional)
- ✅ Per-serial cost tracking (`product_serials.cost_price`)
- ✅ AVG cost calculation สำหรับสินค้า stock
- ✅ แสดง cost ของแต่ละ serial ในหน้ารายละเอียดสินค้า
- ✅ Approve/Receive buttons บนหน้า PO list
- ✅ Product categories CRUD
- ✅ แสดง "ราคาต้นทุน" (ไม่ใช่ราคาขาย) ในหน้าคลังสินค้า

### Phase 2.1 — PO Billing/Payment/PDF (2026-04-24)
- ✅ ฟิลด์ใหม่ตอนสร้าง PO: **ผู้สั่งซื้อ** (staff active), **ชื่องาน**, **เครดิต (วัน)**, ~~หัก ณ ที่จ่าย %~~ (ย้ายไป per-item ใน Phase 2.5)
- ✅ Auto-calc **ครบกำหนด** จาก po_date + credit_days
- ✅ แสดงใน PO Detail: เครดิต/ครบกำหนด/ผู้สั่งซื้อ/ชื่องาน/หัก ณ ที่จ่าย/ยอดชำระ
- ✅ **ปุ่มพิมพ์ PDF** (layout IDEA HOUSE — Sarabun + pink header)
- ✅ **PO บริการอย่างเดียว → auto-received** ตอน approve (ข้ามขั้นรับสินค้า)
- ✅ Backend endpoints พร้อม: `PUT /:id/billing`, `PUT /:id/payment`, `POST /:id/withholding`
- ✅ ปุ่ม "💳 จ่ายเงิน" (placeholder — wire ใน Phase 2.2)

### Phase 2.2 — PO Documents + Auth (2026-04-24)
- ✅ **เอกสารแนบ PO** — upload/ดู/ลบ (PDF, รูป, Word, Excel, max 20 MB)
- ✅ ตาราง `po_documents` + CASCADE delete
- ✅ auth middleware รองรับ **token จาก ?t= query string** (สำหรับ `<a href>` และ PDF print)

### Phase 2.3 — PDF Quality + Per-Item Description (2026-04-25)
- ✅ **เปลี่ยน PO PDF เป็น WeasyPrint** — แก้ปัญหาสระไทยลอย/ซ้อน (reportlab ไม่จัด GPOS)
- ✅ **Dockerfile: Alpine → Debian (node:20-slim)** + Pango/Cairo/HarfBuzz deps
- ✅ **Layout PDF compact professional**: title 20pt, body 9pt, address 8.5pt
- ✅ **Single left signature block** เฉพาะ "ในนาม บริษัทเรา" (ตัด supplier signature ออก)
- ✅ **Logo support** ผ่าน `backend/src/assets/logo.png`
- ✅ **Per-item description** — เพิ่ม column `po_items.description TEXT` + textarea ใต้แต่ละ item row
- ✅ PDF แสดง description ใต้ชื่อสินค้า (แทนการใส่ job_name ซ้ำในทุก item)

### Phase 2.4 — PO Edit + Unapprove (2026-04-25 evening)
- ✅ **แก้ไข PO** (เฉพาะ status=`draft`) — แก้ได้หมดทุกอย่าง: header + items + supplier + VAT + WHT
- ✅ **ยกเลิกอนุมัติ** (status `approved` → `draft`) — กลับมาแก้ไขได้
  - PO ที่ `received` แล้ว ห้ามยกเลิก (มี serial ผูก stock)
- ✅ Backend endpoints ใหม่:
  - `PUT /:id` — update PO header + items (transaction: DELETE + INSERT items ใหม่)
  - `POST /:id/unapprove` — clear `approved_by`/`approved_at`, status → draft
- ✅ Frontend:
  - ปุ่ม **"แก้ไข"** ในตาราง list PO (เฉพาะ draft)
  - ปุ่ม **"แก้ไข"** ใน PO Detail modal footer (เฉพาะ draft)
  - ปุ่ม **"ยกเลิกอนุมัติ"** สีแดง ใน PO Detail modal footer (เฉพาะ approved)
  - ใช้ `POFormModal` ตัวเดิม รับ prop `editPO` → prefill ข้อมูล + เปลี่ยน method PUT/POST อัตโนมัติ
  - Auto-load PO detail (รวม items) เมื่อเปิดแก้ไขจาก list

### Phase 2.5 — Per-Item WHT (2026-04-25 evening)
- ✅ **หัก ณ ที่จ่ายระดับรายการ** — แต่ละ item เลือก % ได้เอง (เลิกใช้ระดับ PO header)
- ✅ Database:
  - เพิ่ม column `po_items.wht_rate NUMERIC(5,2)` + `po_items.wht_amount NUMERIC(15,2)`
  - Migration script: `migration_po_item_wht.sql` (backfill: PO ที่เคยมี wht_rate header → กระจายลงทุก item)
  - `purchase_orders.wht_rate` deprecated (เก็บ column ไว้แต่ set = 0 เสมอ); `purchase_orders.wht_amount` = sum ของ items
- ✅ Backend (`POST /` + `PUT /:id`):
  - คำนวณ `wht_amount` ต่อ item = `quantity × unit_price × wht_rate / 100`
  - Sum รวมเป็น `wht_amount` ของ PO header
- ✅ Frontend:
  - **POFormModal**: ลบ field "หัก ณ ที่จ่าย %" จาก header → เพิ่ม column **"หัก %"** (dropdown 0/1/2/3/5/10/15) + **"หักเงิน"** ในตาราง items
  - กล่องสรุปท้าย form: "รวมหัก ณ ที่จ่าย" + "ยอดชำระสุทธิ" (แสดงเฉพาะเมื่อมี WHT)
  - **PODetailModal**: เพิ่ม column "หัก %" + "หักเงิน" ในตาราง items (ตัวเลขสีชมพู `#c41556`)
  - Footer summary: "รวมหัก ณ ที่จ่าย" (ไม่แสดง %)
- ✅ PDF (`generate_po_pdf.py`):
  - เพิ่ม column **"หัก"** ขวาสุดในตาราง items (แสดงเฉพาะ %, ตัวสีชมพู)
  - ตัด row "หัก ณ ที่จ่าย" จาก meta panel ขวาบน (ซ้ำซ้อน)
  - Footer label: "หักภาษี ณ ที่จ่าย {wht_rate}%" → **"หัก ณ ที่จ่าย"** (ไม่ใส่ %)
  - ปรับ column widths: qty 16→15mm, price 28→25mm, total 26→24mm, wht 11mm

### Phase 2.7 — Pay Modal + Auto-WHT + Cancel (2026-04-26)
- ✅ **Pay Modal** — กรอกข้อมูลการจ่ายเงิน + auto-create ใบหัก ณ ที่จ่าย
  - เลือก bank account จาก dropdown (จาก company_bank_accounts)
  - กรอก reference, payment_amount, payment_date, payment_method, notes
  - หลังกดยืนยัน → save payment + auto-create WHT (ถ้า PO มี wht_amount > 0)
- ✅ **Cancel Payment** — ยกเลิกการจ่ายเงิน
  - ปุ่มแดง "↶ ยกเลิก" บน header PO Detail (เฉพาะที่ paid แล้ว)
  - ลบ payment data + cancel ใบ WHT ที่ auto-create จาก PO นี้ทุกใบ
- ✅ Backend endpoints:
  - `PUT /:id/payment` — บันทึก payment + createWHTForPO (ถ้ามี WHT)
  - `POST /:id/payment/cancel` — clear payment + cancel WHT (status=cancelled)
  - `POST /:id/withholding` — manual create WHT (ใช้ใน edge case)

### Phase 2.8 — Bank Accounts + Slip Upload (2026-04-26)
- ✅ **Bank Accounts CRUD** — Settings page tab ใหม่
  - Table: company_bank_accounts (bank_name, branch, account_no, account_name, type, display_order)
  - CRUD modal: BankAccountFormModal
  - Active/inactive toggle
- ✅ **Slip Upload** — แนบใบโอนเงินใน PO ที่จ่ายแล้ว
  - Section "การชำระเงิน" ใน PO Detail
  - SlipList component: แสดง list ของ slip + รูป preview + download
  - Multi-file upload (`doc_type='slip'` ใน po_documents)
  - ใช้ partial filter: `GET /api/purchase-orders/:id/documents?type=slip`
- ✅ **Filter po_documents โดย doc_type** — แยก general (เอกสารทั่วไป) vs slip (ใบโอน)

### Phase 2.9 — Per-Item income_type + Multi-WHT per PO (2026-04-26)
- ✅ Database (`migration_po_income_type.sql`):
  - `po_items.income_type VARCHAR(50)` + index partial
  - `withholding_tax.source_po_id INTEGER` (FK → purchase_orders) — link 1 PO → many WHT
  - Backfill: rows ที่ wht_rate>0 → income_type='ม.3 เตรส' default
- ✅ Backend:
  - POST/PUT PO รับ income_type ต่อ item + บังคับเลือกถ้า wht_rate > 0
  - **createWHTForPO refactored** — group items by income_type → loop create
  - 1 PO อาจมี **หลายใบ WHT** (แยกตาม income_type)
  - GET /:id ส่ง `withholding_docs[]` (array) — backward-compat กับ withholding_id เก่า
  - payment/cancel: cancel **ทุกใบ** WHT ที่ source_po_id=PO นี้
- ✅ Frontend:
  - POFormModal: column "ประเภท" (dropdown) ก่อน "หัก %" — disable ถ้า rate=0
  - PODetailModal: แสดง column ประเภทรายตัว
  - Payment section: render withholding_docs[] เป็น list ของกล่องสีชมพู

### Phase A — POForm/PODetail Modal → Page (2026-04-27)
- ✅ **เพิ่ม `react-router-dom` 6.20.0** — deep link + browser back/forward
- ✅ **URL routes:**
  - `/purchase` — list
  - `/purchase/new` — create form
  - `/purchase/:id` — detail page (ใหม่!)
  - `/purchase/:id/edit` — edit form
- ✅ **App** ครอบ `<BrowserRouter>` + `<Routes>` สำหรับ /purchase/* paths
- ✅ **หน้าอื่น** (Staff, Payroll, Stock, etc.) **ยังเป็น state-based** ใน catch-all `<Route path="*">`
- ✅ **Sidebar** — เมนู "ใบสั่งซื้อ" ใช้ `useNavigate('/purchase')`, highlight ตาม URL (`useLocation`)
- ✅ POFormPage / PODetailPage:
  - Width 1100px (เต็มกว่าเดิม 880px)
  - ปุ่ม "← กลับ" ใช้ `navigate(-1)`
  - หลัง save → `navigate('/purchase/:id')` → Detail page ของ PO ที่เพิ่งสร้าง
- ✅ **CSS global**: ลบ spinner ของ input number (apply ทั้ง app)
- ✅ **Cleanup**: ลบ `frontend/App.jsx` legacy (Phase 1 file ที่ไม่ได้ import)
- ✅ nginx.conf มี `try_files` แล้ว → SPA refresh ทำงาน

### Phase B1 — WHT Form: rate dropdown + auto-calc + multi-page PDF (2026-04-27)
- ✅ **WHT Form items: dropdown หัก % แทน input number**
  - Column "หัก %" ใหม่ (0/1/2/3/5/10/15) ก่อน "ภาษี"
  - Column "ภาษี" → read-only, bg เทา, auto-calc `tax = income × rate / 100`
  - Edit ใบเก่า: reverse-calc rate (Option C: ลองตรง ±0.01, ถ้าไม่ตรงปล่อย '')
- ✅ **WHT auto-sum totals**
  - "รวมเงินได้" + "รวมภาษี" → read-only sum จาก items
  - handleSubmit คำนวณ totals จาก items (sync DB กับที่แสดง)
- ✅ **Multi-page PDF** (`generate_50twi.py` refactor):
  - แยก `render_page(c, d)` — วาด 1 หน้า (ไม่สร้าง canvas/save)
  - เพิ่ม `_num_to_thai_words(n)` per-page
  - `generate(fname, d)` loop items → `render_page` + `c.showPage()` ระหว่างหน้า
  - **1 row item = 1 หน้า PDF** (รวมในไฟล์เดียว)
  - แต่ละหน้าใช้ pnd_form/income_type/total ของ row นั้น → ติ๊ก ภ.ง.ด.ตรง

### Phase B2 — PO Form แบบ ภ.ง.ด. + Multi-WHT per (ภ.ง.ด. × ประเภท) (2026-04-27)
- ✅ Database (`migration_po_pnd_form.sql`):
  - `po_items.pnd_form VARCHAR(20)` + index partial
  - Backfill: rows ที่ wht_rate>0 → pnd_form='ภ.ง.ด.3' default
- ✅ Backend:
  - POST/PUT PO รับ pnd_form ต่อ item + บังคับเลือกถ้า wht_rate > 0
  - **createWHTForPO group by compound key** `(pnd_form + income_type)` → 1 group = 1 ใบ WHT
  - 2 items ทั้งคู่ ภ.ง.ด.3 + ม.3 เตรส → 1 ใบ; +1 item ภ.ง.ด.53 + 40(2) → +1 ใบแยก (รวม 2 ใบ)
  - ลบ `pickPndForm` helper (ใช้ group.pnd_form แทน)
- ✅ Frontend:
  - **ย้าย PND_FORMS / INCOME_TYPES / WHT_RATES ขึ้น top-level** → shared ระหว่าง WHT Page + PO Form
  - POForm: เพิ่ม column **"แบบ ภ.ง.ด."** ก่อน "ประเภท" — 3 dropdowns ติดกัน (ภ.ง.ด. | ประเภท | หัก %)
  - Validation: บังคับเลือกทั้ง pnd_form + income_type ถ้า rate>0
  - PODetail: column ภ.ง.ด.รายตัว
  - Sync income_type options ใน PO Form ใช้ INCOME_TYPES (เลิก hardcode '40(8)')

### Phase 2.10 — Payroll Documents & Workflow (2026-04-27 evening)

#### 📄 รายงานเงินเดือน
- ✅ **Excel:** `GET /api/payroll-export/excel?year=Y&month=M` (รวมแถว formula SUM)
- ✅ **PDF:** `GET /api/payroll-export/pdf?year=Y&month=M` (WeasyPrint, A4 landscape)
- ✅ **แบ่ง 3 กลุ่มอัตโนมัติ** ตาม `staff_salary.employee_type`:
  - 🏷️ **รายเดือน** (`monthly`) → กลุ่ม 1
  - 🏷️ **รายสัญญาจ้าง** (`contract`) → กลุ่ม 2
  - 🏷️ **รายวัน** (`daily`) → กลุ่ม 3
- ✅ Subtotal แต่ละกลุ่ม (formula SUM ใน Excel) + label สีฟ้าอ่อน (#e6f4fb) + summary ท้ายตาราง
- ✅ ปกส.ที่ต้องนำส่ง = `SUM(social_security) × 2` (ลูกจ้าง + นายจ้าง)

#### 🧾 สลิปเงินเดือน
- ✅ **Bulk:** `GET /api/payroll-documents/payslip?year=Y&month=M` — PDF 2 สลิป/หน้า A4 portrait
- ✅ **Single:** `+ &staff_id=N` — สลิปคนเดียว
- ✅ **ยอดสุทธิเป็นตัวอักษรไทย** ("หกหมื่นห้าพันสี่ร้อย...บาท...สตางค์") — ฟังก์ชัน `num_to_thai()` ใน script
- ✅ เส้นประคั่นกลางหน้าสำหรับพับ/ตัด

#### 🏥 สปส. 1-10
- ✅ **PDF:** `GET /api/payroll-documents/sso?year=Y&month=M` (สำหรับเก็บแฟ้ม)
- ✅ **Excel:** `GET /api/payroll-documents/sso/excel?year=Y&month=M` (format e-Filing — sheet name `'000000'` + 6 คอลัมน์เป๊ะ)
- ✅ กรองอัตโนมัติเฉพาะ `staff_salary.social_security_eligible = true`
- ✅ PDF ใช้ค่าจ้างหลัง cap (max 17,500); Excel ใช้ค่าจ้างจริง (ไม่ cap — ระบบ สปส. cap เอง)

#### 🔓 ยกเลิกการอนุมัติ Payroll
- ✅ Backend: `PUT /api/payroll/unapprove/:year/:month`
- ✅ Frontend: ปุ่ม **🔓 ยกเลิกอนุมัติ** สีเหลืองอำพัน — แสดงเฉพาะตอนทุกแถว approved แล้ว

#### 📤 ปุ่ม Export ในหน้า Payroll
- ✅ 5 ปุ่มมุมขวาบนของ controls bar:
  - 📊 รายงาน Excel · 📄 รายงาน PDF · 🧾 สลิปเงินเดือน · 🏥 สปส. PDF · 🏥 สปส. Excel
- ✅ แสดงเฉพาะตอน `records.length > 0`

#### 🛠️ Files ใหม่
- `backend/src/utils/generate_payroll_pdf.py` (WeasyPrint)
- `backend/src/utils/generate_payroll_excel.js` (exceljs)
- `backend/src/utils/generate_payslip_pdf.py` (WeasyPrint)
- `backend/src/utils/generate_sso_pdf.py` (WeasyPrint)
- `backend/src/utils/generate_sso_excel.js` (exceljs — format e-Filing)
- `backend/src/routes/payroll-export.js`
- `backend/src/routes/payroll-documents.js`

#### ⚠️ บทเรียนสำคัญ Phase 2.10
1. **PDF ใช้ WeasyPrint เท่านั้น** (ห้าม ReportLab) — เริ่มแรกใช้ ReportLab → สระไทยซ้อนทับ → ต้อง refactor เป็น WeasyPrint
2. **ห้ามเดา enum value** — assume `employee_type` มีแค่ 2 ค่าจริงๆมี 3 → ต้องแก้รอบ 2
3. **ตรวจ 3 ชั้นเสมอ** (Disk → Container → Runtime) — ไฟล์ใน VM ใหม่แล้ว แต่ container ยังใช้ของเก่าเพราะลืม rebuild


### Phase 2.11 — Subcategory UI Restored (2026-04-27 night)
- ✅ **CategoriesTab** — dropdown หมวดหลัก + tree view (📁 + ↳ indent)
- ✅ **ProductFormModal** — dropdown indent หมวดย่อยใต้หมวดหลัก (มีอยู่แล้ว)
- ✅ **StockPage filter** — cascade dropdown หมวดหลัก → หมวดย่อย (มีอยู่แล้ว)
- ⚠️ **บทเรียน:** UI subcategory เคยทำแล้วแต่หาย (`App.jsx.bak_subcategory` 0 bytes) → ก่อน patch ใหม่ต้อง grep verify ก่อนเสมอ ห้ามเชื่อ compaction summary


### Phase 2.12 — Tax Calc Refactor (2026-04-29)

#### 2.12A — Tax with Payroll History + Projection
- ✅ **เปลี่ยนวิธีคำนวณภาษีหัก ณ ที่จ่ายรายเดือน**
  - เดิม: `salary × 12` ตลอดปี → ปรับเงินเดือนกลางปีแล้วภาษีคำนวณผิด
  - ใหม่: `yearly = SUM(past payroll) + (current_salary × remaining_months)`
  - รวม `salary + bonus + overtime + other_income` ของแต่ละเดือนที่ผ่านมา
  - ใช้เป็น guideline สำหรับหัก ณ ที่จ่ายรายเดือน (เกณฑ์เดียวกับสรรพากร)
- ✅ Frontend: ดึง payroll history ตอนเปิดหน้าคำนวณ + แสดง projection
- 📝 Commit: `49879d8`

#### 2.12B — Backend WHT Recalc on Generate
- ✅ **Backend คำนวณ WHT ใหม่ตอน generate payroll** (ไม่ใช่แค่หน้า preview)
  - เดิม: WHT คำนวณตอน frontend preview เท่านั้น → DB เก็บค่าผิดถ้า user generate ผ่าน
  - ใหม่: backend `POST /api/payroll/generate` recalc WHT ตามสูตรใหม่ก่อน insert
- ✅ Frontend: sync ตารางสรุป UI ให้ตรงกับ DB
- 📝 Commit: `b2e0520`


### Phase 2.13 — PO List UX & Stock Subcategory Fix (2026-04-30)

#### 📋 PO List Enhancements
- ✅ **เพิ่ม column "ครบกำหนด"** — แสดง `due_date` เป็น locale ไทย หรือ `-` ถ้าไม่มี
- ✅ **เพิ่ม column "การชำระเงิน"** — badge ตาม `payment_status`:
  - 🟢 `paid` → "✓ ชำระแล้ว"
  - ⚪ `unpaid` → "ยังไม่ชำระ"
  - ⚠️ ระบบจริงมีแค่ 2 ค่า (เคยเดามั่วเป็น 3 ค่า → แก้รอบ 2)
- ✅ **เพิ่ม footer total row** — แสดงจำนวน PO + ยอดรวมทุก PO ท้ายตาราง
  - ใช้ `<tfoot>` semantic HTML, bg เทาอ่อน, text navy bold
  - แสดงเฉพาะตอนมี orders > 0
- 🚨 **Multi-company future-proofing:** footer ตอนนี้รวม PO ทั้งหมดในระบบ — เมื่อทำ multi-company + pagination ในอนาคตต้องคิดว่ายอดรวมหมายถึง "ของหน้านี้" หรือ "ทั้งระบบหลัง filter"

#### 🗑️ PO Delete via DB
- ✅ ลบ PO id=1 (PO2026040001) ผ่าน DB ตรงๆ เพราะ status=`received` → backend API ปฏิเสธ
- ⚠️ Backend `DELETE /:id` ยังจำกัดเฉพาะ `status='draft'` → อนาคตอาจขยายให้ลบ approved/cancelled ได้ (พร้อม soft-delete pattern)

#### 📁 Stock Subcategory Display Fix
- ✅ แก้ bug หน้าหมวดหมู่ไม่แสดง subcategory — เปลี่ยน `fetch('/api/product-categories')` → `?flat=1`
- ⚠️ เห็น **section 10.19** สำหรับ root cause + วิธีตรวจ

#### ⚠️ บทเรียนสำคัญ Phase 2.13
1. **Vite content hash อาจซ้ำเดิม** — ตรวจ 3 ชั้นต้องเช็ค **เนื้อหา** ไม่ใช่ **ชื่อไฟล์ JS** (section 10.18)
2. **Backend default response shape ต้อง verify** — tree vs flat ทำให้ filter ผิด (section 10.19)
3. **ห้ามเดา enum** — payment_status มีแค่ unpaid/paid (section 7) ไม่มี partial


### Phase 2.14 — Brand + Product Images + Detail UX (2026-05-03)

#### 🏷️ Brand (ยี่ห้อ)
- ✅ DB: `products.brand VARCHAR(100)` (nullable)
- ✅ Backend products.js: search/POST/PUT รองรับ brand
- ✅ Frontend StockPage: column "ยี่ห้อ" หลัง Model + รวมในช่องค้นหา
- ✅ Frontend Form/Detail: field + sub-header แสดง brand

#### 📸 Product Images
- ✅ DB: ตาราง `product_images` + partial unique index (1 cover/product)
- ✅ Backend: 5 endpoints ใหม่
  - `GET    /api/products/:id/images`
  - `POST   /api/products/:id/images` (multipart, max 5 รูป/สินค้า, 5MB/รูป)
  - `GET    /api/products/:id/images/:imgId/file` (สำหรับ `<img src>` ใช้ ?t= query)
  - `PUT    /api/products/:id/images/:imgId/cover`
  - `DELETE /api/products/:id/images/:imgId` (auto-reassign cover)
- ✅ Multer: max 5 รูป/สินค้า, 5MB/รูป, .jpg/.png/.webp
- ✅ Storage: `/app/uploads/products/{product_id}/` (volume `uploads_data` เดิม)
- ✅ Frontend `ProductImageGallery` component:
  - Thumbnail grid + ★ toggle cover + ✕ delete + click preview เต็มจอ
  - รูปแรกที่อัพ = cover อัตโนมัติ
  - **อยู่เฉพาะใน Detail modal** — Form (เพิ่ม/แก้ไข) ไม่มีอัพรูป (เก็บไว้พิจารณาภายหลัง)

#### 📝 Description Block UX
- ✅ Frontend `ProductDescriptionBlock` component (block แยกใน Detail body):
  - กล่องเทาอ่อน + paragraph แรก + bullet list บรรทัดที่เหลือ
  - ถ้า > 5 บรรทัด → collapse + ปุ่ม "▼ ดูรายละเอียดเพิ่ม (+N บรรทัด)"
- ⚠️ เริ่มแรก patch ใส่ใน sub-header (Phase 2.14.1) → อ่านยาก → revert + redesign เป็น block แยก (Phase 2.14.2)

#### 💰 Stock Table — Layout ใหม่
- ✅ ลบ column "หน่วย" → เพิ่ม column "ราคาขาย" (`sell_price`, 2 ตำแหน่งทศนิยม)
- ✅ Layout ใหม่: รหัส | Model | ยี่ห้อ | ชื่อสินค้า | ประเภท | หมวดหมู่ | ราคาต้นทุน | ราคาขาย | คงเหลือ
- ⚠️ Column "ราคาต้นทุน" ในตาราง = `avg_cost || cost_price` (ไม่ใช่ sell_price!) — ตามที่ตกลงไว้

#### 🏷️ Fixed Legacy Bug
- ✅ Form label "ราคาต้นทุน" ที่ผูกกับ `sell_price` → เปลี่ยนเป็น "ราคาขาย"
- ⚠️ Column ตารางคงไว้ "ราคาต้นทุน" (ดึง avg_cost || cost_price) ตามคำขอ
- 📝 Bug นี้อยู่มานานก่อน Phase 2.14 — เจอเพราะผู้ใช้ถามว่า "ราคาทุน vs ราคาต้นทุน ต่างยังไง"

#### ⚠️ บทเรียนสำคัญ Phase 2.14
1. **Patch ทีละ step ปลอดภัยกว่ารวบ** — ส่งเป็น 5 patch (`.14`, `.14.1`–`.14.4`) ผู้ใช้ test แต่ละ step ก่อนไปต่อ → จับปัญหา UX ได้ทัน เช่น "รายละเอียดดูติดกัน"
2. **UX ต้อง iterate** — Phase 2.14.1 ใส่ description ใน sub-header → ผู้ใช้บอกอ่านยาก → 2.14.2 redesign เป็น component แยก
3. **Check label vs binding** — เจอ legacy bug "ราคาต้นทุน" ↔ sell_price ที่อยู่มานาน
4. **partial unique index ดีกว่า trigger** สำหรับ "1 cover/product" — atomic + simple ใน DB level
5. **Token via `?t=` query** สำหรับ `<img src>` — endpoint ต้อง authenticate แต่ HTTP `<img>` ไม่ส่ง Authorization header (ใช้ pattern เดิมระบบ — middleware/auth.js รองรับทั้ง 2 แบบ)


### Phase 3.1 — Customer Master + Contacts + Documents (2026-05-03)

#### 🏢 Customer Master
- ✅ DB: `customers` (CUS-0001 sequence) + `customer_contacts` (1 customer = many)
- ✅ Partial unique indexes:
  - `uq_customers_tax_id` — tax_id UNIQUE เฉพาะที่ไม่ใช่ null/empty
  - `uq_customer_contacts_one_primary` — 1 customer = 1 primary contact
- ✅ Backend `customers.js`: 14 endpoints (5 customer + 4 contact + 4 documents + 1 PATCH alias)
- ✅ Auto-set `is_primary=TRUE` ตอน contact แรก / auto-reassign ตอนลบ primary
- ✅ Application-level tax_id duplicate check (message ชัดเจน — ไม่ใช่ DB error generic)
- ✅ Frontend: เมนู "🏢 ลูกค้า" ใน sidebar
- ✅ Frontend: CustomersPage + CustomerFormModal + CustomerDetailModal + CustomerContactModal
- ⚠️ Modal-on-modal — CustomerContactModal ใช้ `zIndex: 10001` เพราะเปิดทับ DetailModal

#### 📎 Customer Documents (Phase 3.1.1)
- ✅ DB: `customer_documents` (FK CASCADE)
- ✅ Backend: 4 endpoints (list/upload/download/delete) + multer config
- ✅ Multer: max 20 MB, .pdf/.jpg/.png/.doc/.docx/.xls/.xlsx
- ✅ Storage: `/app/uploads/customers/{customer_id}/` (volume `uploads_data` เดิม)
- ✅ Frontend `CustomerDocumentsSection` component:
  - Pending file preview (yellow box) ให้กรอก notes ก่อนยืนยันแนบ
  - Table + icon ตาม mime (🖼️/📄/📝/📊/📎)
  - Click ชื่อไฟล์ = preview/download (ใช้ `?t=` token query)
- ✅ ไม่มี doc_type — ใช้ field `notes` อธิบายแทน

#### 📁 Repository Hygiene
- ✅ แก้ `.gitignore` — ปลด track ของ `db/migrations/*.sql`
  - เดิม: `migration_*.sql` กิน pattern ทุก path → migrations หายจาก repo
  - ใหม่: ignore root + `!db/migrations/*.sql` (negation)
- ✅ Commit migrations เก่าเข้า repo: `migration_phase_2.14.sql`, `migration_customer_documents.sql`, `migration_phase_3.1.sql`

#### ⚠️ บทเรียนสำคัญ Phase 3.1
1. **ระวัง gitignore pattern กว้าง** — `migration_*.sql` ที่ตั้งไว้ Phase 2.10 → กิน Phase 2.14+ ลงไปด้วย ตรวจไม่เจอเพราะ `git status` clean ตลอด → migrations หายจาก repo
2. **Modal-on-modal ต้อง z-index สูงกว่า** — ใช้ `zIndex: 10001` ใน overlay style override
3. **Smoke test API ก่อน Frontend** — Phase 3.1 step 2 (curl test 5 case) ทำให้ step 3 (Frontend) ลื่นไม่ต้อง debug backend
4. **PATCH alias สำหรับ PUT** — ตามบทเรียน 10.11 — กัน method mismatch
5. **App-level duplicate check ดีกว่า DB error** — เช่น tax_id → message อ้างอิง record ที่ซ้ำได้


### Backup & Tooling (2026-04-25)
- ✅ **`backup.sh`** — full backup script (DB dump + source tar + junk cleanup + .gitignore update)
- ✅ Backup files อยู่ที่ `~/sales-system-backups/`
- ✅ `.gitignore` exclude `*.bak`, `backup_*.sql`, `patch_*.py`, legacy fonts

### UX Improvements
- ✅ Form modal ไม่ปิดเมื่อคลิก overlay (ป้องกันเผลอคลิกแล้วเสียข้อมูล)
- ✅ Decimal formatting 2 ตำแหน่งในการแสดงราคา

### Bug Fixes
- ✅ NaN bug ใน stock_qty (null + NaN guard ทุก UPDATE query)
- ✅ Stock qty ซิงค์กับจำนวน serial จริง
- ✅ **Supplier edit "กด Save แล้วเงียบ"** (2026-04-25) — Backend register `PATCH /:id` แต่ frontend ส่ง `PUT` → 404 + HTML response → JSON parse พังเงียบ ๆ → แก้โดยเพิ่ม `router.put('/:id')` เป็น alias ของ `router.patch('/:id')` ใช้ shared handler `updateSupplier` (ดู 10.11)
- ✅ **PO PDF สระไทยลอย/ซ้อน** (2026-04-25) — เปลี่ยนจาก reportlab เป็น WeasyPrint (ดู 10.12) + เปลี่ยน Docker base เป็น Debian
- ✅ **PO PDF: job_name ซ้ำในทุก item** (2026-04-25) — เพิ่ม column `po_items.description` + ใช้ description รายตัวแทน

### Pending (รอทำต่อ)
- ⏳ Responsive mobile layout
- ⏳ 50ทวิ document handling (กระดาษพิมพ์เฉพาะของกรมสรรพากร)
- ⏳ Multi-company support
- ⏳ ปุ่มเปลี่ยน password ผ่าน UI (Profile page)
- ⏳ **Phase 3:** Quotation module
- ⏳ **Phase 3:** Sales Order module
- ⏳ **Phase 3:** Invoice module
- ⏳ Support Department workflow
- ⏳ Account Department workflow
- ⏳ Maintenance tasks
- ⏳ Job support

---

**Last Updated:** 2026-05-03 (Phase 3.1 — Customer Master + Contacts + Documents)

**Latest Commits:**
- `<NEW_HASH>` — docs: update CHANGELOG + PROJECT_CONTEXT for Phase 3.1 + add migrations
- `95da4c7` — feat(customer): customer master + contacts + documents (Phase 3.1)
- `e40583f` — docs: update CHANGELOG + PROJECT_CONTEXT for Phase 2.14
- `9f29733` — feat(stock): brand + product images + description UX (Phase 2.14)
- `f3ac8bb` — feat(po): list columns + footer total + fix category subcategory display
- `f9a04b9` — fix(payroll): backend recalc wht ตอน generate + sync ตารางสรุป UI
- `49879d8` — fix(tax): คำนวณภาษีหัก ณ ที่จ่ายโดยใช้ payroll history + projection
- `ab98f88` — feat(stock): restore subcategory UI + lesson learned
- `0f27262` — feat(payroll): documents export + unapprove + WeasyPrint migration
- `c088ccf` — docs: update PROJECT_CONTEXT.md for Phase 2.7-B2

**Pending commit:**
- (none — ล่าสุด Phase 3.1 + docs commit เรียบร้อย)

**Pending features (รอทำต่อ):**
- ⏳ Phase 3.2: Quotation module (next!)
- ⏳ Filter + pagination หน้า PO list (server-side)
- ⏳ Hybrid form: อัพรูปได้ตอนเพิ่ม/แก้สินค้า — เก็บไว้พิจารณาภายหลัง
- ⏳ Phase 3 ต่อ: Sales Order, Service Contract, Invoice, Payment
