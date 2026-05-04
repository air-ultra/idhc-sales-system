[ paste เนื้อหา CHANGELOG_phase_3.1_entry.md ทั้งหมดที่นี่ ]
## [Phase 3.3B.3 — Sales Order Frontend (List Page + Routes)] — 2026-05-04

### Added

#### 🎨 Frontend Skeleton
- **Sidebar menu item** "📋 ใบสั่งขาย" — แทรกระหว่าง "🧾 ใบเสนอราคา" กับ "📦 คลังสินค้า"
- **Path detection** `isOnSalesOrderRoute` (mirror Quotation pattern) + extended active highlight ternary chain + extended fallback exclude list
- **Sidebar handleClick** เพิ่ม branch สำหรับ `'sales-order'` ให้ navigate ตรงๆ ไป `/sales-order` (ก่อนหน้านี้ตกใน else branch แล้วใช้ `onNavigate(item.key)` ทำให้ link ไม่ทำงาน)
- **4 routes ใหม่:** `/sales-order`, `/sales-order/new`, `/sales-order/:id`, `/sales-order/:id/edit`

#### 📋 SalesOrderListPage
- Search box + status filter (4 states: draft / approved / completed / cancelled)
- Table columns: เลขที่ SO, วันที่, ลูกค้า, ชื่องาน, จำนวนรายการ, ยอดรวม, สถานะ, QT link, จัดการ
- Status badge สี: gray (draft) / blue (approved) / green (completed) / red (cancelled)
- Action buttons per row: แก้ไข + ลบ (เฉพาะ draft) + ยกเลิก
- **Footer total row** สรุปยอดรวมทั้งหมด (ไม่นับ cancelled SOs)
- Empty state พร้อม emoji + คำแนะนำ
- ใช้ `QtInvoiceLayout.navy` + `QtInvoiceLayout.textMuted` (global const) แทน `C` ที่ scope local ใน QuotationDetailPage

#### 🚧 Placeholders
- **SalesOrderFormPage** — รอ implement ใน Phase 3.3B.4
- **SalesOrderDetailPage** — รอ implement ใน Phase 3.3B.5

### Lesson Learned

21. **Terminal display ≠ file content (auto-markdown rendering)** — terminal client บางตัว auto-render dotted identifiers (เช่น `QtInvoiceLayout.navy`, `xxx.py`) เป็น markdown link ตอน paste/echo → display เห็น `[QtInvoiceLayout.navy](http://...)` แต่ในไฟล์จริงเป็น plain `QtInvoiceLayout.navy` → ใช้ `od -c` หรือ `xxd` verify byte จริงเสมอเมื่อสงสัย
22. **Sidebar handleClick ต้องเพิ่ม branch ทุก route ที่ใช้ navigate to specific path** — ถ้าไม่เพิ่ม จะตกใน else branch ที่ใช้ `onNavigate(item.key)` ทั่วไป → link ไม่ทำงาน (ไม่ navigate)
23. **`C` constant ใน QuotationDetailPage เป็น local alias** — `const C = QtInvoiceLayout` ที่บรรทัด 4608 อยู่ภายใน function scope → ใช้นอก function ไม่ได้ → ต้องอ้างอิง `QtInvoiceLayout.xxx` ตรงๆ (เป็น const global)

## [Phase 3.3B.1+2 — Sales Order Extra Fields + Attachments Backend] — 2026-05-04

### Added

#### 🗄️ DB (migration_phase_3.3B.1.sql)
- **ALTER `sales_orders`** เพิ่ม 6 columns:
  - `billing_customer_id INTEGER` FK customers — เปิดบิลในนามอื่น (NULL = ใช้ customer หลัก)
  - `site_customer_id INTEGER` FK customers — สถานที่ติดตั้ง (NULL = ใช้ customer หลัก)
  - `installation_date DATE` — วันติดตั้ง (optional, แยกจาก delivery_date)
  - `credit_days INTEGER` — เครดิต X วัน (สำหรับ Phase 3.5 คำนวณ invoice due_date)
  - `payment_terms_notes TEXT` — เงื่อนไขการชำระ (วางบิล/รับเช็ค/บัญชีติดต่อ)
  - `reference_no VARCHAR(100)` — เลขที่อ้างอิง / customer PO number (pattern เดียวกับ `quotations.reference_no`)
- **New table `so_attachments`** — multi-file uploads per SO
  - `file_name` (user-defined) + `original_name` (uploaded filename) + `file_path` + `file_size` + `mime_type` + `uploaded_by` + `uploaded_at`
  - ON DELETE CASCADE with sales_orders
- 2 indexes ใหม่: `idx_so_billing_customer`, `idx_so_site_customer`

#### 🔌 Backend (`salesOrders.js`)
- **multer setup** — uploads/so/ directory (auto-create), filename pattern: `so_<id>_<ts>_<safe_filename>`, 20MB max
- **GET /:id extended:**
  - JOIN customers as `bc` (billing) + `sitec` (site) → return `billing_customer_name/address/tax_id/branch/postal_code` + `site_customer_name/address/postal_code/phone`
  - Include `attachments[]` array in response
- **POST/PUT/PATCH extended** — handle 6 new fields with `d.credit_days != null ? Number(d.credit_days) : null` numeric coercion
- **4 new endpoints:**
  - `GET    /:id/attachments` — list
  - `POST   /:id/attachments` — upload (multipart, field `file`, optional `file_name` body override)
  - `GET    /attachments/:attId/download` — stream file with Content-Disposition
  - `DELETE /attachments/:attId` — delete DB row + best-effort file unlink

### Decisions

| Decision | Reasoning |
|---|---|
| `billing_customer_id` NULL default | Most SOs bill in name of buyer — only set when different |
| `site_customer_id` NULL default | Most SOs install at buyer address — only set when different |
| Both pick from `customers` master | Per user request — if entity not in system, must create customer first |
| `reference_no` (not `customer_po_number`) | Pattern parity with `quotations.reference_no`, easy copy on QT→SO |
| `credit_days` INTEGER + `payment_terms_notes` TEXT | Hybrid: structured (for Phase 3.5 due_date math) + flex (for arbitrary notes) |
| `so_attachments` no `doc_type` | Free-text user-defined name allows any document (PO ลูกค้า / Email / etc.) without rigid taxonomy |

## [Phase 3.3A — Sales Order DB + Backend CRUD] — 2026-05-04

### Added

#### 🗄️ DB Schema (migration_phase_3.3A.sql)
- **`sales_orders`** — main SO header table
  - SO numbering: `SO202605####` per-month scan-last (same pattern as PO/QT — no DB sequence)
  - Status enum: `draft` / `approved` / `completed` / `cancelled`
  - Money fields: subtotal / discount (% or amount) / VAT (inclusive or exclusive) / WHT / grand_total / net_payable + cached `total_cost`
  - Workflow timestamps: `approved_at` / `completed_at` / `cancelled_at` + `cancel_reason`
  - **Partial unique index** `uq_so_one_per_quotation` — บังคับ 1 QT = 1 active SO (allow recreate after cancel)
- **`so_items`** — line items (mirror `quotation_items` pattern)
  - `product_id` NULLABLE in draft (free-text allowed) — enforced NOT NULL on approve via app logic
  - `unit_cost` + `total_cost` cached for margin lookups without joining serials
- **`so_item_serials`** — junction `so_items` ↔ `product_serials`
  - **`UNIQUE(serial_id)`** strict — 1 serial sold once forever (RMA deferred to future phase)
  - `picked_by` + `picked_at` metadata for audit trail
- **`product_serials.sold_at`** — TIMESTAMPTZ, set on approve for warranty/service contract calcs

#### 🔌 Backend (`salesOrders.js`)
- **6 endpoints:**
  - `GET    /api/sales-orders` — list with filters (status, customer_id, q for search)
  - `GET    /api/sales-orders/:id` — detail with items + customer + contact + salesperson JOINs (incl. `staff_contact.mobile_phone`)
  - `POST   /api/sales-orders` — transactional create with items
  - `PUT    /api/sales-orders/:id` — update (draft only)
  - `PATCH  /api/sales-orders/:id` — alias for PUT (lesson 10.11)
  - `POST   /api/sales-orders/:id/cancel` — soft cancel with reason; rejects if status is approved/completed
  - `DELETE /api/sales-orders/:id` — hard delete, draft only
- **Helpers** (mirror `quotations.js`):
  - `genSoNumber()` — scan-last per YYYYMM
  - `computeAmounts()` — server-authoritative subtotal / discount (% or amount) / VAT (inclusive or exclusive) / WHT / grand_total / net_payable
  - `validateItems()` — name + qty > 0 sanity checks
- **Friendly 409** error on `uq_so_one_per_quotation` violation

### Decisions Captured (Phase 3.3 design Q&A)

| # | Decision |
|---|---|
| Q1 | Stock cut on **approve SO** with serial picker popup |
| Q2 | Logic 3 ทาง — service / non_stock / stock |
| Q3 | บังคับ map free-text → real product ก่อน approve |
| Q4 | 1 QT = 1 SO (strict 1:1) |
| Q5 | SO เป็น internal doc — user เพิ่ม items ได้, ราคาแถม 0 ได้ |
| Q5.2 | Track cost ผ่าน `serial.cost_price` ตอน approve |
| Q5.3 | ไม่ทำ PDF Phase นี้ |
| Q6 | RMA: strict UNIQUE(serial_id) — refactor partial unique ใน Phase ภายหลัง (clean migration) |

### Pending (Phase 3.3 sub-phases)

- ⏳ **3.3B.4** — SalesOrderFormPage (mirror QuotationFormPage + 6 new fields)
- ⏳ **3.3B.5** — SalesOrderDetailPage (Modern card layout)
- ⏳ **3.3B.6** — Attachments upload UI
- ⏳ **3.3C** — Create SO from QT (one-click) + Free-text mapping dialog
- ⏳ **3.3D** — Approve flow + Serial Picker Popup + Stock Cut + Cost Calc

## [Phase 3.2B.1 — Quotation PDF Export] — 2026-05-04

### Added

#### 📄 Quotation PDF Generator (WeasyPrint)
- **`backend/src/utils/generate_quotation_pdf.py`** — Python script ใหม่
  - **Title navy** (`#183b59`) — แตกต่างจาก PO PDF (pink `#c41556`) ตามที่ตกลงกันไว้ใน design
  - **Running page header** (logo + title + company info + meta box + customer block + ผู้ติดต่อ) — แสดงทุกหน้าผ่าน WeasyPrint `@page { @top-left { content: element(pageHeader) } }` + `position: running()`
  - **`@page` margin-top: 85mm** — เผื่อพื้นที่ running header เต็ม
  - **Items table:**
    - เพิ่ม column **"หน่วย"** (PO ไม่มี — สำคัญในใบเสนอราคา)
    - Free-text rows highlight สีเหลือง + badge "รายการพิเศษ"
    - `page-break-inside: avoid` ป้องกัน item row ถูก split กลางคัน → ปัดทั้ง row ไปหน้าใหม่
  - **Totals:** subtotal → discount → VAT → grand total (bold) → WHT (ถ้ามี) → ยอดชำระ (bold)
  - **Stamp:** overlay บนกล่อง signature ขวา (rotate -6deg + `mix-blend-mode: multiply`) — toggle ผ่าน `data['show_stamp']`
  - **Thai date format** ตามรูปแบบไทย (`30 เมษายน 2569`)
  - **`numToThaiWords`** — port helper จาก `purchaseOrders.js` (shared pattern)

#### 🔌 Backend Endpoint
- **`GET /api/quotations/:id/pdf`** — endpoint ใหม่ใน `quotations.js`
  - Reuse query เดียวกับ `GET /:id` (customer + contact + salesperson + `staff_contact.mobile_phone` JOIN)
  - Server-authoritative numeric coercion ทุก money field + `numToThaiWords` คำนวณที่ backend
  - Map `quotation_items.total_price` → `line_total` ใน JSON ให้ Python script ใช้ (DB column ยังเป็น `total_price` ตามเดิม)
  - **`?stamp=1` (default) | `?stamp=0`** — query param ควบคุม stamp
  - Streams PDF ผ่าน `execSync python3` + JSON pipe + tmp file cleanup (pattern เดียวกับ PO PDF)
  - Filename: `${quotation_no}.pdf` (เช่น `QT202604001.pdf`)

#### 🎨 Frontend
- **ปุ่ม "🖨️ พิมพ์ PDF"** ใน `QuotationDetailPage` action bar — ก่อนปุ่ม "แก้ไข"
  - `window.open` เปิด PDF ใน tab ใหม่
  - ส่ง `?stamp=` ตาม checkbox **"☑ ใส่ตราประทับ"** ที่ action bar (default = เปิด)
  - Token ใส่ผ่าน `?t=` query string (รองรับโดย `middleware/auth.js`)

#### 🗂️ Assets + Repository
- **`backend/src/assets/stamp.png`** — copy จาก `frontend/public/stamp.png` (ให้ Python script เห็น)
- **`.gitignore`** — เพิ่ม pattern `test_qt*.pdf` + `test_po*.pdf` กัน ad-hoc PDF render samples

### Lesson Learned

15. **ห้ามเดา DB column name (ซ้ำบทเรียน 10.10/10.17)** — ครั้งนี้พลาดเดา `quotation_items.line_total` (จริงคือ `total_price` ตาม PO pattern เดิม) → ทำให้ ยอดรวมใน PDF เป็น 0.00 → ต้อง `\d quotation_items` verify ก่อนเขียน JSON mapping
16. **WeasyPrint running header ต้อง `@page` margin ใหญ่พอครอบ header content** — เริ่มแรก margin-top: 78mm แต่ header content ~95mm → items overflow ขึ้นบน → ต้องลด font/spacing ของ header (compact CSS) + เพิ่ม margin-top จนพอดี (final = 85mm)
17. **`page-break-inside: avoid` บน `<tr>`** — ป้องกัน item row ถูก split กลางคัน (เคสเจอ: 10 items, item ที่ 10 description อยู่ติดท้ายหน้า → บรรทัดบนสุดอยู่หน้า 1, รายละเอียดต่อหน้า 2) → ใส่ `page-break-inside: avoid` + `break-inside: avoid` (CSS3) บน `tbody tr` → ทั้ง row ปัดไปหน้าใหม่
18. **`position: fixed` ใน WeasyPrint คนละความหมายกับ browser** — ใช้แล้ว signature/stamp แสดงทุกหน้าในบาง scenario (ไม่ใช่ที่ต้องการ) → เปลี่ยนเป็น flow ปกติ + `position: relative/absolute` แทน + ใช้ running element สำหรับ repeating header เท่านั้น
19. **Terminal client auto-link `xxx.md` / `xxx.py` พังหมด heredoc Python** — paste แบบ `python3 << 'PYEOF'` ที่มี `xxx.py` filename → terminal เปลี่ยนเป็น `[xxx.py](http://xxx.py)` → Python syntax พัง → **default workflow: ส่ง patch script via WinSCP เสมอ** (ทำมาตลอด task ของวัน)
20. **Stamp overlay positioning** — เริ่มแรกใช้ `position: fixed` ที่ root → stamp ลอยไปอยู่ที่ title หน้าแรก → fix: ใช้ `.signatures { position: relative }` + `.stamp { position: absolute }` ภายใน → stamp ติดอยู่กับกล่อง signature เสมอ ทุกหน้า

### Pending (Phase 3.2C+)
- ⏳ Email send — แนบ PDF ไปยัง customer email (next!)
- ⏳ Filter + pagination หน้า QT list (server-side)
- ⏳ Bulk export — เลือกหลายใบ → zip PDF

## [Phase 3.2A.2 — Quotation Form UX + Contact Label] — 2026-05-04

### Added

#### 🪞 Quotation Form — Customer Info แบ่ง 2 column
- เดิม: กล่องข้อมูลลูกค้าใน QuotationFormPage แสดงเต็มความกว้าง (tax_id/address/phone/email) — ไม่มีข้อมูลผู้ประสานงาน
- ใหม่: split เป็น 2 column ด้วย CSS grid (`gridTemplateColumns: '1fr 1fr'`):
  - **ซ้าย:** ข้อมูลลูกค้า (เดิม)
  - **ขวา:** ข้อมูลผู้ประสานงาน — ชื่อ + แผนก + phone + email + line_id
- Render ขวาเฉพาะเมื่อ `form.contact_id` มีค่า (fallback `1fr` ถ้าไม่เลือก contact)
- Field ใน column ขวาแสดงเฉพาะที่มีค่า (สอดคล้อง pattern เดียวกับ customer info เดิม)
- LINE id แสดงเป็น text "L · LINE: @xxx" (ไม่มี LINE icon ใน QtIcon paths)
- **Component:** `QuotationFormPage` — ใช้ IIFE `(() => { ... })()` หา `selectedContact` จาก `contactsForCustomer`
- 📝 Commit: `b363248`

### Fixed

#### 🏷️ Customer Contact — เปลี่ยน label "ตำแหน่ง" → "แผนก"
- **Scope:** Frontend label only — DB column `customer_contacts.position` ไม่เปลี่ยน
- **เหตุผล:** สอดคล้องกับวิธีจัดการ contact ของ business ไทย (จัดตามแผนก ไม่ใช่ตำแหน่งงาน)
- **จุดที่แก้** (2 จุดใน App.jsx):
  - `CustomerDetailModal` — table column header (`<th>ตำแหน่ง</th>` → `<th>แผนก</th>`)
  - `CustomerContactModal` — form input label (`<label>ตำแหน่ง</label>` → `<label>แผนก</label>`)
- **ไม่แตะ:** Backend payload, API contracts, DB schema — ข้อมูลเดิมยังใช้ได้ + frontend dropdown/QtDetail ที่ render `(${ct.position})` ก็ทำงานเหมือนเดิม
- 📝 Commit: `da25095`

### Lesson Learned

11. **Code อาจพร้อมแล้วก่อนเริ่มเขียน** — task "เพิ่มเบอร์ salesperson ในใบเสนอราคา" → grep ก่อน → เจอบรรทัด 4548-4551 ใน `QuotationDetailPage` มี `{qt.salesperson_phone && ...}` พร้อม backend JOIN `sc.mobile_phone AS salesperson_phone` → **ปัญหาคือ data ไม่ใช่ code** → กรอก `mobile_phone` ของ staff ใน Staff Detail → phone โผล่อัตโนมัติ → **ไม่ต้อง patch อะไรเลย** → บทเรียน: ก่อนเขียน feature ใหม่ → grep verify code path เดิมก่อน อาจประหยัดงาน
12. **อย่าเดา DB schema (ซ้ำบทเรียน 10.10/10.17)** — ครั้งนี้พลาดเดา `staff_contact.work_phone` (ไม่มีจริง — มีแค่ `mobile_phone`) → SQL error → ต้อง `\d staff_contact` verify ก่อนเสมอ ก่อน JOIN/SELECT
13. **Terminal markdown auto-link พังหมดทุก paste** — terminal client บางตัว auto-link `xxx.md` / `xxx.py` กลายเป็น markdown link `[xxx.md](http://xxx.md)` → heredoc + python ที่ paste ตรง terminal พังเงียบๆ → **workflow default: patch script ขนาด > 5 บรรทัด ส่งผ่าน WinSCP เสมอ** (ตามที่พี่ Air ชอบอยู่แล้ว)
14. **`git add -p` แยก commit จากไฟล์เดียวกัน** — เมื่อ patch หลายอันรวมในไฟล์เดียว (label rename + split column) → `git add -p` interactive หา hunk → answer y/n ทีละ chunk → commit แยกได้ clean โดยไม่ต้อง revert/replay

## [Phase 3.2A.1 — Sidebar Navigation Fix from /quotation routes] — 2026-05-04

### Fixed

#### 🧭 Sidebar — กดเมนูอื่นไม่ได้ตอนอยู่หน้าใบเสนอราคา
- **อาการ:** อยู่หน้า `/quotation` หรือ `/quotation/*` → กดเมนูซ้ายอื่นๆ ไม่เปลี่ยนหน้า ยกเว้น "ใบสั่งซื้อ" ที่ทำงานได้
- **Root cause:** ใน `Sidebar.handleClick` (App.jsx:145) — branch fallback (เมนูอื่นๆ ที่ไม่ใช่ purchase/quotation) เช็คเฉพาะ `isOnPurchaseRoute` → URL ค้างที่ `/quotation/*` → React Router match Quotation route ก่อนเข้า catch-all `<Route path="*">` → `setPage(...)` ทำงานแต่จอไม่เปลี่ยน
- **Fix:** เพิ่ม `|| isOnQuotationRoute` ในเงื่อนไข navigate('/'):
  ```js
  // เก่า
  if (isOnPurchaseRoute) navigate('/');
  // ใหม่
  if (isOnPurchaseRoute || isOnQuotationRoute) navigate('/');
  ```
- เมนู "ใบสั่งซื้อ" ทำงานอยู่แล้วเพราะ branch ของตัวเองเรียก `navigate('/purchase')` ตรงๆ — branch fallback ไม่ได้ exercise

### Lesson Learned

10. **Hybrid routing — branches ต้อง symmetric** — ตอนเพิ่ม route group ใหม่ใน Sidebar (Phase 3.2A เพิ่ม `/quotation/*` ต่อจาก `/purchase/*` เดิม) ต้องเช็ค **2 จุดเสมอ**:
    1. Branch ของตัวเอง (กดเมนูตัวเองแล้ว `navigate('/xxx')`)
    2. Branch fallback (กดเมนูอื่นแล้ว `navigate('/')` ออกจาก route ตัวเองก่อน)
    - ถ้าลืมจุดที่ 2 → URL ค้าง → catch-all route ไม่ render → จอไม่เปลี่ยน
    - Pattern ที่ถูก: `if (isOnPurchaseRoute || isOnQuotationRoute || ...) navigate('/');` ก่อน `onNavigate(item.key)`
    - **บทเรียนต่อยอด:** เมื่อมี route group เพิ่มในอนาคต (Sales Order, Invoice, ฯลฯ) → ต้อง update เงื่อนไขนี้ทุกครั้ง

## [Phase 3.2A — Quotation CRUD + Invoice-Style Detail] — 2026-05-03

### Added

#### 📋 Quotation Module — Database
- **`migration_phase_3.2A.sql`** — 2 ตารางใหม่:
  - **`quotations`** (27 columns):
    - `quotation_no` UNIQUE — auto-gen รูปแบบ `QT202605****` (YYYYMM + 4-digit running, reset รายเดือน)
    - `valid_until` (issue_date + valid_days) แยกจาก `credit_days` — สอดคล้อง business semantic
    - `discount_mode` ('percent' | 'amount') + `discount_percent` + `discount_amount` — เลือกได้
    - `vat_rate` (default 7.00) + `vat_amount` + `wht_rate` + `wht_amount`
    - Computed cache: `subtotal`, `amount_after_discount`, `grand_total`, `net_payable`
    - `price_includes_vat` BOOL — รองรับทั้ง inclusive/exclusive
    - FKs: `customer_id` (RESTRICT), `contact_id` (SET NULL), `salesperson_id` (SET NULL), `created_by` (SET NULL)
    - Status: `draft / sent / accepted / rejected` (DB stored) + `expired` (computed on-read)
  - **`quotation_items`** (13 columns):
    - `product_id` **NULLABLE** — รองรับ free-text items + snapshot ทุก field (`product_name`, `product_brand`, `product_model`, `description`, `unit`)
    - **Late binding pattern** — QT รับ free-text ได้ทันทีตอน sales กรอก ไม่ต้องสร้าง product master ก่อน
    - SO stage (Phase 3.3) จะมี mapping dialog บังคับให้ map free-text → real product ก่อน stock cut
- 5 indexes บน `quotations` + 2 บน `quotation_items`

#### 📋 Quotation Module — Backend
- **route `quotations.js`** — 7 endpoints:
  - `GET /api/quotations` — list with filter + customer/salesperson joins
  - `GET /api/quotations/:id` — detail with items + customer + contact + salesperson
  - `POST /api/quotations` — create (transactional with items)
  - `PUT/PATCH /api/quotations/:id` — update (alias) per lesson 10.11
  - `PUT /api/quotations/:id/status` — workflow transition
  - `DELETE /api/quotations/:id`
- **Server-authoritative `computeAmounts()`** — คำนวณ subtotal/discount/VAT/WHT/grand_total ทั้งหมดที่ server (frontend แสดง preview เท่านั้น)
- **`genQuotationNumber()`** — scan-last + increment per YYYYMM (ตาม PO pattern)
- **`effectiveStatus()`** — compute 'expired' on-read โดยไม่บันทึก DB (status='sent' + valid_until ผ่านไปแล้ว = expired)
- **Status validation** — บล็อก 'expired' ใน status update endpoint (เพราะ computed only)

#### 🎨 Quotation Module — Frontend (Modern UI + Invoice-Style)
- **เมนู "🧾 ใบเสนอราคา" ใน sidebar** — ระหว่าง ลูกค้า กับ คลังสินค้า
- **Routes:** `/quotation`, `/quotation/new`, `/quotation/:id`, `/quotation/:id/edit`
- **`QuotationListPage`** — search + filter + status badges + footer total
- **`QuotationFormPage`** (Modern UI):
  - Card sections + sticky top bar + outlined SVG icons (Lucide-style)
  - Customer dropdown auto-fills primary contact + tax_id + address + phone + email
  - "+ เพิ่มจากคลังสินค้า" dropdown product (search code/name/brand)
  - "+ รายการพิเศษ" — free-text item (yellow gradient + left border + ✨ badge)
  - Discount toggle %/บาท · VAT toggle · WHT select 0/1/2/3/5/10/15
  - Sticky summary panel — preview ทุกค่าใน real-time
  - Reuse existing `CustomerFormModal` + `CustomerContactModal` (modal-on-modal z-index)
- **`QuotationDetailPage`** — **ใบเสมือนจริง (invoice-style)**:
  - Header 2-column: Logo + ชื่อบริษัท + ที่อยู่ ซ้าย / "ใบเสนอราคา QUOTATION" + meta box ขวา
  - Customer block + Project/Salesperson block (2 columns + borders)
  - Items table — ขอบทุกช่อง + zebra rows + navy header + แถวว่าง padding ถึง 5 แถว
  - Summary panel — navy "จำนวนเงินรวมทั้งสิ้น" row + WHT optional
  - Notes box bordered
  - Signature footer 2-column: ผู้อนุมัติ/ลูกค้า ซ้าย · ผู้ออกเอกสาร/บริษัท ขวา (มี stamp)
  - **Toggle "☑ ใส่ตราประทับ"** ใน action bar — กดเปิด/ปิดตราได้อิสระ (default = เปิด, ไม่บันทึก DB)
  - Stamp ริมซ้ายของ box ลงนาม (rotate -6deg, mix-blend-mode: multiply) — เหลือพื้นที่กลางสำหรับลายเซ็นจริง
  - Status workflow buttons (ส่ง/ตอบรับ/ปฏิเสธ/back-to-draft)

#### 🎨 Brand Identity
- **Logo file** — `frontend/public/logo.png` (extracted + cropped จาก source logo) ใช้ใน Detail header
- **Stamp file** — `frontend/public/stamp.png` (ตราประทับบริษัท) ใช้ใน Detail signature box ผ่าน CSS `mix-blend-mode: multiply` (พื้น JPG ขาว/เทา ซึมหายไปเอง — ไม่ต้อง process alpha)
- **Brand color update ทั่วระบบ:** `#1e3a5f` → `#183b59` (extracted จาก logo dominant color, 56 occurrences) + `#2d5a87` → `#2d5278` (gradient secondary)
- **Hardcoded company info** ใน Detail page (consistent กับ PO PDF):
  - บริษัท ไอเดีย เฮ้าส์ เซ็นเตอร์ จำกัด (สำนักงานใหญ่)
  - ที่อยู่/Tax ID/โทร/มือถือ/โทรสาร/website (เอกสารเดียวกับ `purchaseOrders.js`)

### Lesson Learned

1. **Free-text items แบบ late binding** — แทนที่จะบังคับสร้าง product ก่อน → QT รับ free-text ทันที + snapshot ทุก field → SO stage ค่อย bind กับ product จริงก่อน stock cut → เร็วและตรง business reality (sales กรอกใบเสนอเร็วๆ ก่อน)
2. **Server-authoritative computation** — frontend คำนวณ preview เท่านั้น, server ทำซ้ำตอน save → ป้องกัน manipulation + เลข tally กันได้แม้ frontend bug
3. **Computed status (`expired`) ไม่ต้องเก็บ DB** — `effectiveStatus()` ตอน read ก็พอ, ไม่ต้อง cron job → ลด moving parts
4. **Patch script — verify schema columns ก่อนเขียน JOIN** — staff ใช้ `first_name_th/last_name_th` ไม่ใช่ `first_name/last_name`, phone อยู่ที่ `staff_contact.mobile_phone` (separate FK table) — เคยพลาดและ debug นาน
5. **Patch end anchor — ใช้ function name ไม่ใช่ comment** — ตอน redesign Detail page เคยใช้ next `/* ===== ` เป็น end → กิน `PurchaseOrderPage` หายเลย → แก้เป็น `function PurchaseOrderPage()` ปลอดภัยกว่า
6. **iframe rebuild verify** — patch ผ่าน, จอ user ไม่เปลี่ยน เพราะ container ไม่ rebuild → ต้อง `docker rmi` ก่อน `up --build` ทุกครั้ง (Docker layer cache)
7. **State pattern unique per component** — ใช้ `[busy, setBusy] + [err, setErr]` 2 บรรทัด → ปรากฏ 5+ ครั้งในไฟล์ → patch fail "FOUND 3 TIMES" → แก้ใช้ context unique เช่น `[qt, setQt] + [busy] + [err]` 3 บรรทัดติดกัน
8. **CSS mix-blend-mode: multiply** — JPG พื้นทึบใช้ในใบ HTML ได้สวย ไม่ต้องลบพื้นด้วย Pillow → simpler + ผลดีกว่า (no edge artifacts)
9. **Toggle UX state in component, not DB** — feature flag กลับด้านได้บ่อยๆ ไม่จำเป็นต้องบันทึก → React state พอ + ไม่ต้อง migration

### Pending (Phase 3.2B)
- PDF Export — WeasyPrint pattern (font Sarabun, scripts `backend/src/utils/generate_quotation_pdf.py`)
- Email send — แนบ PDF ไปยัง customer email

## [Phase 3.1 — Customer Master + Contacts + Documents] — 2026-05-03

### Added

#### 🏢 Customer Master
- **DB:** ตาราง `customers` ใหม่ (14 columns)
  - Auto-gen `customer_code` รูปแบบ `CUS-0001` (sequence `customer_code_seq`)
  - Partial unique index `uq_customers_tax_id` — `tax_id` UNIQUE เฉพาะที่ไม่ใช่ null/empty
  - FK `created_by → users` (ON DELETE SET NULL)
- **DB:** ตาราง `customer_contacts` ใหม่ (1 customer = many contacts)
  - Partial unique index `uq_customer_contacts_one_primary` — บังคับ 1 customer = 1 primary
  - FK `customer_id → customers` (ON DELETE CASCADE)
- **Backend:** route ใหม่ `customers.js` — 10 endpoints:
  - **Customers:** GET (list/by-id) + POST + PUT/PATCH (alias) + DELETE
  - **Contacts:** GET list + POST + PUT + DELETE per customer
  - Auto-set `is_primary=TRUE` ตอน contact แรก
  - Auto-reassign primary ตอนลบ primary contact
  - tax_id duplicate check ที่ application level (message ชัดกว่า DB error)
- **Frontend `App.jsx`:**
  - เพิ่มเมนู "🏢 ลูกค้า" ใน sidebar
  - `CustomersPage`: list + search + filter active
  - `CustomerFormModal`: create/edit (10 fields)
  - `CustomerDetailModal`: customer info + contacts table + ★ toggle primary
  - `CustomerContactModal`: add/edit contacts (z-index 10001 — modal-on-modal)

#### 📎 Customer Documents (Phase 3.1.1)
- **DB:** ตาราง `customer_documents` ใหม่ (9 columns)
  - FK `customer_id` ON DELETE CASCADE / `uploaded_by` ON DELETE SET NULL
- **Backend:** เพิ่ม 4 endpoints + multer config
  - `GET    /api/customers/:id/documents`
  - `POST   /api/customers/:id/documents` (multipart, max 20 MB)
  - `GET    /api/customers/:id/documents/:docId/download`
  - `DELETE /api/customers/:id/documents/:docId`
- **Multer:** `.pdf, .jpg, .jpeg, .png, .doc, .docx, .xls, .xlsx`, 20 MB/ไฟล์
- **Storage:** `/app/uploads/customers/{customer_id}/` (volume `uploads_data` เดิม)
- **Frontend `CustomerDocumentsSection`** (component ใหม่ ใน `CustomerDetailModal`):
  - Pending file preview (yellow box) — ให้กรอก notes ก่อนยืนยันแนบ
  - Table แสดงไฟล์ + icon ตาม mime (🖼️/📄/📝/📊/📎)
  - Format ขนาดไฟล์ (B/KB/MB)
  - Click ชื่อไฟล์ = preview/download (`?t=` token query)
  - ไม่มีหมวดหมู่ — ใช้ field `notes` อธิบายแทน

### Changed

#### 📁 Repository Hygiene
- **`.gitignore`:** track migrations ใน `db/migrations/` แทนที่จะ ignore ทั้งหมด
  - เดิม: `migration_*.sql` กิน pattern ทุก path → migrations ไม่ถูก commit เลย
  - ใหม่: ignore `migration_*.sql` ที่ root (throwaway) แต่ negate `!db/migrations/*.sql`
  - เหตุผล: reproducibility — clone repo + รัน migrations ทั้งหมด → ได้ DB schema ครบ
- **เพิ่ม `db/migrations/`** เข้า repo:
  - `migration_phase_2.14.sql` (brand + product_images — เคยไม่ได้ commit)
  - `migration_customer_documents.sql`
  - `migration_phase_3.1.sql`

### Lesson Learned

1. **ระวัง gitignore pattern กว้าง** — `migration_*.sql` ที่ตั้งไว้ Phase 2.10 เพื่อกัน throwaway ที่ root → กิน Phase 2.14 ลงไปด้วย ตรวจไม่เจอเพราะ `git status` clean → migrations หายจาก repo
2. **Modal-on-modal ต้อง z-index สูงกว่า** — `CustomerContactModal` ใช้ `zIndex: 10001` เพราะเปิดทับ `CustomerDetailModal`
3. **Application-level duplicate check ดีกว่า DB error** — ตรวจ tax_id ก่อน insert → message ชัด เช่น `"เลขผู้เสียภาษีนี้มีอยู่แล้ว (CUS-0001 — บริษัท XYZ)"` แทน generic `unique constraint violation`
4. **Auto-set primary บน contact แรก** — ลด friction (เพิ่ม contact ครั้งแรก → ไม่ต้องกด primary เอง)
5. **PATCH alias สำหรับ PUT** — ตามบทเรียน Phase 2 (section 10.11) — กัน method mismatch
6. **File icon ตาม mime + extension** — UX ดีกว่าโชว์ icon เดียว แยก type ได้ในตาราง
7. **Smoke test API ครบก่อนทำ Frontend** — Phase 3.1 step 2 (curl test ครบ 5 case) → step 3 ทำได้ลื่นไม่ต้อง debug backend

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
