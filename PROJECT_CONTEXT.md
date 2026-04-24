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
  purchaseOrders.js      # ⚠️ camelCase, มี 15+ endpoints รวม billing/payment/WHT/PDF/docs
  product-categories.js  # ⚠️ มี dash
utils/
  generate_50twi.py      # PDF ใบหัก ณ ที่จ่าย
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
App.jsx                  # ⚠️ single-file ทั้งหมด ~2900+ บรรทัด
  บรรทัด 1-5   : imports + authHeaders helper
  บรรทัด 7-100 : const styles = { ... }   ← ต้องใช้ตัวนี้เท่านั้น
  บรรทัด 100+  : components ทั้งหมด (Login, Layout, Page, Modal)
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

### PDF generation pattern (Python + reportlab)
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
wht_rate NUMERIC(5,2)           # อัตราหัก ณ ที่จ่าย %
wht_amount NUMERIC(15,2)        # ยอดหัก ณ ที่จ่าย

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
```

**`po_documents`** (ใหม่ 2026-04-24)
```
po_id (→ purchase_orders, ON DELETE CASCADE)
file_name VARCHAR(255)      # ชื่อไฟล์ดั้งเดิม
file_path VARCHAR(500)      # ชื่อไฟล์บน disk (timestamp_basename.ext)
mime_type VARCHAR(100)
file_size INTEGER
notes VARCHAR(500)
uploaded_by (→ users)
uploaded_at
# ไฟล์จริงเก็บที่ /app/uploads/po/{po_id}/
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

**`withholding_tax`** + **`withholding_tax_items`** (มีอยู่แล้ว)
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
```

**`staff_documents`** (pattern reference — ใช้แบบเดียวกันกับ po_documents)

---

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
- หัก ณ ที่จ่าย %: เลือก 0/1/3/5 ตอนสร้าง PO
  - 0 = ไม่หัก
  - 1% = ค่าขนส่ง
  - 3% = บริการทั่วไป
  - 5% = ค่าเช่า

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
- ✅ ฟิลด์ใหม่ตอนสร้าง PO: **ผู้สั่งซื้อ** (staff active), **ชื่องาน**, **เครดิต (วัน)**, **หัก ณ ที่จ่าย %**
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

### UX Improvements
- ✅ Form modal ไม่ปิดเมื่อคลิก overlay (ป้องกันเผลอคลิกแล้วเสียข้อมูล)
- ✅ Decimal formatting 2 ตำแหน่งในการแสดงราคา

### Bug Fixes
- ✅ NaN bug ใน stock_qty (null + NaN guard ทุก UPDATE query)
- ✅ Stock qty ซิงค์กับจำนวน serial จริง

### Pending (รอทำต่อ)
- ⏳ **Tab การวางบิล** ใน PO Detail (backend endpoint มีแล้ว)
- ⏳ **Tab การชำระเงิน** + modal จ่ายเงิน (backend endpoint มีแล้ว)
- ⏳ **Modal สร้างใบหัก ณ ที่จ่ายจาก PO** (backend endpoint มีแล้ว)
- ⏳ Responsive mobile layout
- ⏳ 50ทวิ document handling
- ⏳ Multi-company support
- ⏳ Quotation module
- ⏳ Sales Order module
- ⏳ Invoice module
- ⏳ Support Department workflow
- ⏳ Account Department workflow
- ⏳ Maintenance tasks
- ⏳ Job support

---

**Last Updated:** 2026-04-24
**Latest Commit:** `014aa8f` — Phase 2: PO document attachments + query-string auth
**Previous:** `02318f4` — Phase 2: PO billing/payment/credit/WHT + print PDF
