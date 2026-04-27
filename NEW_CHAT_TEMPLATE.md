# 💬 Template ข้อความเปิด chat ใหม่

## วิธีใช้
เวลาเปิด chat ใหม่กับ Claude เพื่อทำงานโปรเจคนี้ต่อ ให้ทำตามนี้:

---

## ✅ ข้อความแบบที่ดีที่สุด (แนะนำ)

**Upload ไฟล์ `PROJECT_CONTEXT.md` ติดไปกับข้อความแรก** แล้วพิมพ์:

```
สวัสดีค่ะ ทำงานต่อ IDHC Sales System นะ

อ่าน PROJECT_CONTEXT.md ที่แนบไปก่อน แล้วบอกสรุปสั้น ๆ
ว่าเข้าใจ project แล้ว โดยเฉพาะ:
- styles object ที่มีอยู่
- pattern backend (query, getClient, authenticate)
- schema columns (supplier_id, po_date, grand_total, etc.)
- DB enum values (employee_type, status, etc.) — ไม่เดา query ก่อน
- PDF engine = WeasyPrint (ห้ามใช้ ReportLab)
- Modal rules (form modal ห้ามปิดเมื่อคลิก overlay)
- กับดักที่ต้องระวัง
- feature ที่ทำเสร็จแล้ว (จะได้ไม่ทำซ้ำ)

วันนี้จะแก้เรื่อง: [บอกสิ่งที่อยากทำ]
```

---

## 📋 ถ้าไม่อยาก upload ไฟล์

Copy-paste ข้อความสั้น ๆ นี้ (แต่จะไม่ครบเหมือน upload ไฟล์):

```
ทำงานต่อโปรเจค IDHC Sales Management System

Context:
- Stack: React + Node/Express + PostgreSQL + Docker
- VM: /home/IDEA-HOUSE/sales-system/
- Repo: https://github.com/air-ultra/idhc-sales-system
- กรุณาอ่านไฟล์ PROJECT_CONTEXT.md ใน repo ก่อน
  (อยู่ที่ root ของ project)

กฎสำคัญ:
1. ใช้ styles object ที่มีอยู่ใน App.jsx บรรทัด 7 เท่านั้น
   ห้ามสร้าง style ใหม่เอง ห้ามเดาสี
2. Backend import: const { query, getClient } = require('../config/database')
3. Column names เฉพาะ: supplier_id / po_date / grand_total / quantity /
   product_code / default_unit / status='draft' (ไม่ใช่ 'pending')
4. PDF engine = WeasyPrint (HTML→PDF) — ห้ามใช้ ReportLab
5. Form modal: ไม่ใส่ onClick={onClose} บน overlay
   View modal (Detail): ใส่ onClick={onClose} บน overlay ได้
6. ภาษาไทย เรียก "พี่"
7. ส่งไฟล์ครบให้ upload ผ่าน WinSCP — ไม่ต้อง sed ยาว ๆ
8. ถ้า block ใหญ่ซับซ้อน ใช้ Python script แทน sed
9. ห้ามเดา enum value — query DB ก่อนเสมอ
10. ตรวจ 3 ชั้นเสมอ: disk → container → runtime

วันนี้อยากทำ: [บอกงานที่จะทำ]
```

---

## 🎯 Tips เพิ่มเติม

### ⚠️ เวลาแก้ไฟล์แล้ว "เหมือนไม่เห็นผล" (ใหม่จาก Phase 2.10)
**ปัญหา:** Dockerfile ใช้ `COPY src/ ./src/` → ไฟล์ถูก bake เข้า image ตอน build
แค่ restart **ไม่พอ** ต้อง rebuild image ใหม่

**ตรวจ 3 ชั้นเสมอ:**
```bash
# 1. Disk (ไฟล์บนเซิร์ฟเวอร์)
ls -la backend/src/utils/generate_payroll_pdf.py

# 2. Container (ไฟล์ที่กำลังรันจริง)
docker compose exec sales-api ls -la /app/src/utils/generate_payroll_pdf.py

# 3. Verify ว่าเนื้อหาตรงกัน
docker compose exec sales-api grep -c "บางคำที่ผมแก้" /app/src/utils/generate_payroll_pdf.py
```

ถ้าไฟล์ใน container เก่า → **rebuild!** ไม่ใช่ restart

### ⚠️ ห้ามเดา enum value (ใหม่จาก Phase 2.10)
ก่อน group/filter ตามค่า column → query ดูค่าจริงใน DB ก่อนเสมอ:

```bash
docker compose exec -T sales-db psql -U sales_admin -d sales_system -c "
SELECT column_name, COUNT(*) FROM table_name GROUP BY column_name ORDER BY 2 DESC;"
```

**ตัวอย่าง enum values ที่ต้องรู้:**
- `staff_salary.employee_type`: `monthly` (รายเดือน) | `daily` (รายวัน) | `contract` (รายสัญญาจ้าง)
- `payroll.status`: `draft` | `approved`
- `purchase_orders.status`: `draft` | `approved` | ...

### ⚠️ ก่อน patch ฟีเจอร์ใดๆ — verify ว่ามีอยู่แล้วหรือยัง (ใหม่จาก Phase 2.11)
**ปัญหา:** Compaction summary ระหว่าง chat อาจตกหล่น — บอกว่า "patch X pending" ทั้งที่เสร็จแล้ว

**วิธีป้องกัน:** ก่อน patch ทุกครั้ง grep code จริงก่อนเสมอ

```bash
# ตัวอย่าง: ก่อนทำฟีเจอร์ subcategory
grep -nE "parent_id|filterMain|หมวดย่อย" frontend/src/App.jsx | head

# ถ้ามี → ฟีเจอร์มีอยู่แล้ว ห้าม patch ซ้ำ
# ถ้าไม่มี → ค่อย patch
```

**ประโยคที่พี่ทักได้:** "verify ก่อน patch — เช็คว่ามีฟีเจอร์อยู่แล้วไหม"

### เวลา Claude เริ่มเดา schema ให้ทัก
ถ้า Claude เริ่มเขียน SQL แล้วใช้ชื่อ column แปลก ๆ เช่น `vendor_id`, `order_date`
→ บอกว่า **"หยุดก่อน ดู schema จริงก่อน"** แล้วให้มันรันคำสั่ง:
```
\d purchase_orders
\d products
\d po_items
\d po_documents
\d product_serials
\d staff_salary
\d payroll
```

### เวลาผลลัพธ์ไม่ตรงที่คิด
ให้ Claude ตรวจ 3 ชั้นเสมอ:
1. **Disk** (`ls -la`, `grep`)
2. **Container** (`docker compose exec sales-api ls /app/src/...`)
3. **Runtime** (`docker compose logs sales-api`)

เพราะ Docker cache งอแงบ่อย

### เวลาแก้แล้วไม่เห็นผล
```bash
docker compose down sales-api
docker rmi sales-system-sales-api
docker compose up -d --build sales-api
docker compose logs --tail 15 sales-api
```

### เวลา Backend crash (หน้าเว็บขึ้น "Unexpected token '<'")
```bash
docker compose logs sales-api --tail=30
# ดู error message แล้วแก้ตามนั้น (มักจะเป็น require path ผิด)
```

### เวลา Frontend ขึ้นหน้าขาว
กด F12 → Console → ดู error
- `ReferenceError: authHeaders is not defined` → บรรทัดแรก App.jsx หาย
- `ReferenceError: docs is not defined` → state หาย (patch ผิดที่)

### เวลา Patch Python ไม่ match
- ตรวจ whitespace ก่อน (leading spaces, tabs)
- ถ้า `OLD` ไม่ match → ใช้ line-based approach แทน
- Script เดิมรันครั้งที่ 2 จะ fail เป็นเรื่องปกติ (เพราะ patch ไปแล้ว)

### ข้อมูล login admin
- Username: `admin`
- Password: `admin8585!`

### Company info ของ "ไอเดีย เฮ้าส์"
hard-code อยู่ใน 2 ที่:
- `backend/src/routes/purchaseOrders.js` (ตอนสร้างใบหัก ณ ที่จ่าย + PDF)
- `frontend/src/pages/WithholdingTaxPage.jsx` → `DEFAULT_PAYER`

---

## 🔖 Feature Map (อ้างอิงเร็ว)

| Feature | สถานะ | Route/Page |
|---|---|---|
| Staff | ✅ Done | `/staff` |
| Departments | ✅ Done | `Settings > 🏢 แผนก` |
| Payroll: รายการเงินเดือน | ✅ Done | `/payroll` |
| Payroll: ยกเลิกอนุมัติ | ✅ Done (Phase 2.10) | ปุ่ม 🔓 |
| Payroll: รายงาน Excel/PDF | ✅ Done (Phase 2.10) | `/api/payroll-export/*` |
| Payroll: สลิปเงินเดือน | ✅ Done (Phase 2.10) | `/api/payroll-documents/payslip` |
| Payroll: สปส. 1-10 PDF+Excel | ✅ Done (Phase 2.10) | `/api/payroll-documents/sso[/excel]` |
| Users/Roles | ✅ Done | `/users` |
| Withholding Tax | ✅ Done | `/withholding` |
| Stock (products/suppliers/categories) | ✅ Done | `คลังสินค้า` |
| Purchase Order | ✅ Done | `ใบสั่งซื้อ` |
| PO: Serial/MAC + cost tracking | ✅ Done | — |
| PO: Billing/Payment/Credit/WHT fields | ✅ DB+API ready | — |
| PO: Print PDF | ✅ Done | — |
| PO: Service auto-receive | ✅ Done | — |
| PO: Document attachments | ✅ Done | — |
| PO: Pay modal + WHT creation UI | ⏳ Backend ready | — |
| Quotation | ⏳ Pending | — |
| Sales Order | ⏳ Pending | — |
| Invoice | ⏳ Pending | — |
| 50ทวิ | ⏳ Pending | — |
| Multi-company | ⏳ Pending | — |
| Mobile responsive | ⏳ Pending | — |

---

## 📌 ประโยคสำคัญที่ช่วย debug

ถ้า Claude เริ่มทำงานผิดพลาด (เช่น เดาชื่อไฟล์/column/สี) พี่ใช้ประโยคพวกนี้ได้:

1. **"หยุดก่อน ดู schema จริงก่อน"** — กันเดา DB column
2. **"เช็ค styles object ที่มีอยู่ก่อน"** — กันสร้าง style ใหม่
3. **"ดูใน index.js ว่า require ไฟล์ชื่ออะไร"** — กันสร้าง route ไฟล์ชื่อผิด
4. **"rebuild แล้วเช็ค docker logs"** — กันคิดว่าแก้แล้วทั้งที่ยังไม่ build
5. **"ส่งไฟล์ครบให้ upload แทน sed"** — กันคำสั่ง sed ยาว ๆ ที่พังง่าย
6. **"เช็คว่า block นี้อยู่ใน component ไหน"** — ก่อนแก้ใช้ `awk` ตรวจ scope
7. **"backup ก่อนแล้วค่อยแก้"** — `cp file file.bak` ก่อน edit ใหญ่
8. **"ตรวจในคอนเทนเนอร์ ไม่ใช่แค่บนดิสก์"** — กันแก้แล้วไม่เห็นผล (Phase 2.10)
9. **"ดูค่าจริงใน DB ก่อน อย่าเดา"** — กันพลาดเรื่อง enum (Phase 2.10)
