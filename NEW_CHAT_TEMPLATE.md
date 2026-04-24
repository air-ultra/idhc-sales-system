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
4. Form modal: ไม่ใส่ onClick={onClose} บน overlay
   View modal (Detail): ใส่ onClick={onClose} บน overlay ได้
5. ภาษาไทย เรียก "พี่"
6. ส่งไฟล์ครบให้ upload ผ่าน WinSCP — ไม่ต้อง sed ยาว ๆ
7. ถ้า block ใหญ่ซับซ้อน ใช้ Python script แทน sed

วันนี้อยากทำ: [บอกงานที่จะทำ]
```

---

## 🎯 Tips เพิ่มเติม

### เวลา Claude เริ่มเดา schema ให้ทัก
ถ้า Claude เริ่มเขียน SQL แล้วใช้ชื่อ column แปลก ๆ เช่น `vendor_id`, `order_date`
→ บอกว่า **"หยุดก่อน ดู schema จริงก่อน"** แล้วให้มันรันคำสั่ง:
```
\d purchase_orders
\d products
\d po_items
\d po_documents
\d product_serials
```

### เวลาผลลัพธ์ไม่ตรงที่คิด
ให้ Claude ตรวจ 3 ชั้นเสมอ:
1. **Disk** (`ls -la`, `grep`)
2. **Container** (`docker compose exec sales-api ls /app/src/...`)
3. **Runtime** (`docker compose logs sales-api`)

เพราะ Docker cache งอแงบ่อย

### เวลาแก้แล้วไม่เห็นผล
```bash
docker compose down
docker rmi sales-system-sales-api sales-system-sales-web
docker compose up -d --build
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
| Payroll | ✅ Done | `/payroll` |
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
