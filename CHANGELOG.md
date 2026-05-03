[ paste เนื้อหา CHANGELOG_phase_3.1_entry.md ทั้งหมดที่นี่ ]
## [Phase 2.14 — Brand + Product Images + Detail UX] — 2026-05-03

### Added

#### 🏷️ Brand (ยี่ห้อ)
- **DB:** `products.brand VARCHAR(100)` (nullable)
- **Backend `products.js`:** GET search รวม brand + POST/PUT รับ/บันทึก brand
- **Frontend StockPage:** column "ยี่ห้อ" หลัง Model + รวมในช่องค้นหา
- **Frontend ProductFormModal:** field "ยี่ห้อ" ใต้ Model
- **Frontend ProductDetailModal:** sub-header แสดง "Model · ยี่ห้อ · หมวด · คงเหลือ"

#### 📸 Product Images
- **DB:** ตาราง `product_images` ใหม่ (file_name, file_path, is_cover, display_order, …)
  - Partial unique index `uq_product_images_one_cover` — บังคับ 1 product = 1 cover เท่านั้น
  - FK product_id ON DELETE CASCADE / uploaded_by ON DELETE SET NULL
- **Backend:** เพิ่ม 5 endpoints + multer config
  - `GET    /api/products/:id/images`
  - `POST   /api/products/:id/images` (multipart, max 5 รูป/สินค้า, 5MB/รูป, .jpg/.png/.webp)
  - `GET    /api/products/:id/images/:imgId/file` (สำหรับ `<img src>` ใช้ `?t=` query)
  - `PUT    /api/products/:id/images/:imgId/cover`
  - `DELETE /api/products/:id/images/:imgId` (auto-reassign cover ถ้าลบรูป cover)
- **Storage:** `/app/uploads/products/{product_id}/` (volume `uploads_data` เดิม)
- **Frontend `ProductImageGallery`** (component ใหม่ ใน `ProductDetailModal`):
  - Thumbnail grid + ★ toggle cover + ✕ delete + click preview เต็มจอ
  - รูปแรกที่อัพ = cover อัตโนมัติ

#### 📝 Description Block UX
- **Frontend `ProductDescriptionBlock`** (component ใหม่):
  - กล่องเทาอ่อนแยกใน Detail body (ไม่ยัดใน sub-header)
  - บรรทัดแรก = paragraph, บรรทัด 2+ = bullet list (•)
  - ถ้า > 5 บรรทัด → collapse + ปุ่ม "▼ ดูรายละเอียดเพิ่ม (+N บรรทัด)"

#### 💰 Stock Table — ราคาขาย column
- ลบ column "หน่วย" → เพิ่ม column "ราคาขาย" (`sell_price`, format 2 ตำแหน่งทศนิยม)
- เหตุผล: ตารางมี 9 columns เต็มแล้ว — หน่วยส่วนใหญ่ซ้ำๆ "ชิ้น" ดูใน Detail ได้
- Layout ใหม่: รหัส | Model | ยี่ห้อ | ชื่อสินค้า | ประเภท | หมวดหมู่ | ราคาต้นทุน | **ราคาขาย** | คงเหลือ

### Fixed

#### 🏷️ Form label — "ราคาต้นทุน" สับสนกับ column ในตาราง
- **Form** field ที่ผูกกับ `sell_price` มี label "ราคาต้นทุน" → **เปลี่ยนเป็น "ราคาขาย"**
- Column ในตารางยังคง "ราคาต้นทุน" ตามคำขอ (ดึงจาก `avg_cost || cost_price`)
- Backend ไม่แตะ — เปลี่ยนแค่ UI label

### Lesson Learned

1. **Patch ทีละ step ปลอดภัยกว่ารวบ** — Phase 2.14 ส่งเป็น 5 patch (`.14`, `.14.1`–`.14.4`) ผู้ใช้ทดสอบแต่ละ step ก่อนไปต่อ → จับปัญหา UX ได้ทัน เช่น "รายละเอียดดูติดกัน"
2. **อย่าเดาก่อน paste จริง** — เริ่ม patch description ใส่ใน sub-header (Phase 2.14.1) → ผู้ใช้บอกอ่านยาก → revert + redesign เป็น component แยก (Phase 2.14.2)
3. **Check label vs binding ทุกครั้ง** — เจอ legacy bug "ราคาต้นทุน" ผูกกับ `sell_price` ที่อยู่มานานก่อน Phase นี้
4. **partial unique index ดีกว่า trigger** สำหรับ "1 cover/product" — atomic + simple
5. **Token via `?t=` query** สำหรับ `<img src>` — endpoint รูปต้อง `authenticate` แต่ HTTP `<img>` ไม่ส่ง Authorization header

---

# Changelog

โครงการ IDHC Sales Management System

รูปแบบ: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) + [Conventional Commits](https://www.conventionalcommits.org/)

---

## [Phase 2.11 — Subcategory UI Restored] — 2026-04-27 night

### Added
- **CategoriesTab UI** — รองรับ parent_id เต็มรูปแบบ (เดิมเป็นแค่ flat list)
  - Dropdown "เพิ่มเป็นหมวดหลัก / เพิ่มในหมวด: X"
  - Tree view: 📁 หมวดหลัก + ↳ indent หมวดย่อย
  - Confirm dialog ตอนลบหมวดหลักที่มีลูก (CASCADE delete)
- **ProductFormModal** — dropdown หมวดหมู่แบบ indent (มีอยู่แล้วก่อน chat นี้)
- **StockPage filter** — cascade dropdown หมวดหลัก → หมวดย่อย (มีอยู่แล้วก่อน chat นี้)

### Fixed
- UI subcategory เคยถูกเขียนแล้วแต่หายไประหว่าง chat ก่อนๆ (`App.jsx.bak_subcategory` ขนาด 0 bytes)
- Backend (`product-categories.js` + DB trigger `trg_enforce_category_depth`) พร้อมอยู่แล้ว — ขาดแค่ UI

### Lesson Learned
- **อย่าเชื่อ compaction summary** — code จริงคือ source of truth
- ก่อน patch ใหม่ → grep ก่อนเสมอ ป้องกัน duplicate work

---

## [Phase 2.10 — Payroll Documents & Workflow] — 2026-04-27

### Added

#### 📄 รายงานเงินเดือน (Payroll Reports)
- **Excel:** `GET /api/payroll-export/excel?year=Y&month=M` — รายงานเงินเดือน format ตาม template มาตรฐาน
- **PDF:** `GET /api/payroll-export/pdf?year=Y&month=M` — รายงานเงินเดือน PDF (WeasyPrint)
- แบ่งกลุ่มอัตโนมัติตาม `staff_salary.employee_type`:
  - 🏷️ **รายเดือน** (`monthly`) — กลุ่ม 1
  - 🏷️ **รายสัญญาจ้าง** (`contract`) — กลุ่ม 2
  - 🏷️ **รายวัน** (`daily`) — กลุ่ม 3
- Subtotal แต่ละกลุ่ม + summary ท้ายตาราง (ปกส. = ลูกจ้าง × 2)

#### 🧾 สลิปเงินเดือน (Pay Slip)
- **Bulk:** `GET /api/payroll-documents/payslip?year=Y&month=M` — PDF รวมทุกคน 2 สลิป/หน้า A4
- **Single:** `+ &staff_id=N` — สลิปคนเดียว
- ยอดสุทธิเป็นตัวอักษรไทย ("หกหมื่นห้าพันสี่ร้อย...บาท...สตางค์")
- เส้นประคั่นกลางสำหรับพับ/ตัด

#### 🏥 สปส. 1-10 (Social Security)
- **PDF:** `GET /api/payroll-documents/sso?year=Y&month=M` — รายการแสดงการส่งเงินสมทบ (สำหรับเก็บแฟ้ม)
- **Excel:** `GET /api/payroll-documents/sso/excel?year=Y&month=M` — Format e-Filing (sheet name `'000000'` + 6 คอลัมน์เป๊ะตามต้นฉบับ สปส.)
- กรองอัตโนมัติเฉพาะ `staff_salary.social_security_eligible = true`

#### 🔓 ยกเลิกการอนุมัติ (Unapprove Payroll)
- `PUT /api/payroll/unapprove/:year/:month` — เปลี่ยน status จาก `approved` → `draft`
- เคลียร์ `approved_by` ให้ NULL
- Frontend: ปุ่ม **🔓 ยกเลิกอนุมัติ** สีเหลืองอำพัน — แสดงเฉพาะตอนทุกแถว approved แล้ว

#### 📤 ปุ่ม Export ในหน้า Payroll
- เพิ่ม 5 ปุ่มมุมขวาบนของ controls bar:
  - 📊 รายงาน Excel
  - 📄 รายงาน PDF
  - 🧾 สลิปเงินเดือน
  - 🏥 สปส. PDF
  - 🏥 สปส. Excel
- แสดงเฉพาะตอน `records.length > 0`

### Changed

#### 🐍 PDF Engine: ReportLab → WeasyPrint
- เปลี่ยนทั้ง `generate_payroll_pdf.py`, `generate_payslip_pdf.py`, `generate_sso_pdf.py` เป็น WeasyPrint
- เหตุผล: ReportLab ไม่มี text shaping engine → สระไทยซ้อนทับ
- WeasyPrint ใช้ HarfBuzz → render ภาษาไทยถูกต้อง
- Pattern: HTML/CSS template → PDF (เหมือน `generate_po_pdf.py`)

### Fixed

- รายงาน PDF/Excel ไม่แยกกลุ่มตาม `employee_type` (เพราะโค้ดเดิมรองรับแค่ `monthly`/`daily` แต่จริงมี `contract` ด้วย)

### Infrastructure

- Backend: เพิ่ม dependency `exceljs ^4.4.0`
- Backend: register routes ใหม่ใน `index.js`:
  - `app.use('/api/payroll-export', ...)`
  - `app.use('/api/payroll-documents', ...)`

### Repository Hygiene

- ย้าย `create_admin_user.sql` + `reset_data.sql` → `db/scripts/` พร้อม `README.md`
- เพิ่ม `CHANGELOG.md` (ไฟล์นี้)
- Update `PROJECT_CONTEXT.md` + `NEW_CHAT_TEMPLATE.md`

---

## [Phase 2.9 — PO Form ภ.ง.ด. + Multi-WHT] — 2026-04-25

### Added
- PO: per-item `income_type` + multi-WHT per (ภ.ง.ด. × ประเภท)
- PO Form แบบ ภ.ง.ด. + Multi-WHT
- WHT rate dropdown + multi-page PDF

---

## [Phase 2.7-2.8] — 2026-04-24

### Added
- Pay modal + bank accounts + slip upload
- PO modal → page (full page edit)

---

## Note

ก่อนหน้า Phase 2.7 ดู git log ใน repo
