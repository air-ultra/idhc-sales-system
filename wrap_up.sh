#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Wrap up: Subcategory feature + docs lesson + git commit
# ═══════════════════════════════════════════════════════════════

set -e
cd /home/IDEA-HOUSE/sales-system

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Step 1: Update CHANGELOG.md (เพิ่ม subcategory)"
echo "═══════════════════════════════════════════════════════════"

# ใช้ python แทรก section ใหม่หลังบรรทัดแรก
python3 << 'PYEOF'
with open('CHANGELOG.md', 'r', encoding='utf-8') as f:
    content = f.read()

# ตรวจว่ามี Subcategory entry แล้วหรือยัง
if 'Subcategory' in content or 'หมวดย่อย' in content:
    print("  ⚠️ มี subcategory entry ใน CHANGELOG อยู่แล้ว — ข้าม")
else:
    new_entry = '''## [Phase 2.11 — Subcategory UI Restored] — 2026-04-27 night

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

'''
    # แทรกหลัง "# Changelog\n\nโครงการ..." จบ
    marker = '---\n\n## [Phase 2.10'
    if marker in content:
        content = content.replace(marker, '---\n\n' + new_entry + '## [Phase 2.10', 1)
        with open('CHANGELOG.md', 'w', encoding='utf-8') as f:
            f.write(content)
        print("  ✅ เพิ่ม Phase 2.11 entry ใน CHANGELOG.md")
    else:
        print("  ❌ ไม่พบ marker '## [Phase 2.10' ใน CHANGELOG.md — ข้าม")
PYEOF

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Step 2: Update NEW_CHAT_TEMPLATE.md (lesson)"
echo "═══════════════════════════════════════════════════════════"

python3 << 'PYEOF'
with open('NEW_CHAT_TEMPLATE.md', 'r', encoding='utf-8') as f:
    content = f.read()

if 'verify ก่อน patch' in content:
    print("  ⚠️ มี lesson นี้แล้ว — ข้าม")
else:
    # เพิ่ม tip ใหม่ก่อน "### เวลา Claude เริ่มเดา schema"
    new_tip = '''### ⚠️ ก่อน patch ฟีเจอร์ใดๆ — verify ว่ามีอยู่แล้วหรือยัง (ใหม่จาก Phase 2.11)
**ปัญหา:** Compaction summary ระหว่าง chat อาจตกหล่น — บอกว่า "patch X pending" ทั้งที่เสร็จแล้ว

**วิธีป้องกัน:** ก่อน patch ทุกครั้ง grep code จริงก่อนเสมอ

```bash
# ตัวอย่าง: ก่อนทำฟีเจอร์ subcategory
grep -nE "parent_id|filterMain|หมวดย่อย" frontend/src/App.jsx | head

# ถ้ามี → ฟีเจอร์มีอยู่แล้ว ห้าม patch ซ้ำ
# ถ้าไม่มี → ค่อย patch
```

**ประโยคที่พี่ทักได้:** "verify ก่อน patch — เช็คว่ามีฟีเจอร์อยู่แล้วไหม"

'''
    marker = '### เวลา Claude เริ่มเดา schema'
    if marker in content:
        content = content.replace(marker, new_tip + marker, 1)
        with open('NEW_CHAT_TEMPLATE.md', 'w', encoding='utf-8') as f:
            f.write(content)
        print("  ✅ เพิ่ม tip 'verify ก่อน patch' ใน NEW_CHAT_TEMPLATE.md")
    else:
        print("  ❌ ไม่พบ marker — ข้าม")
PYEOF

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Step 3: Update PROJECT_CONTEXT.md (mark subcategory done)"
echo "═══════════════════════════════════════════════════════════"

python3 << 'PYEOF'
with open('PROJECT_CONTEXT.md', 'r', encoding='utf-8') as f:
    content = f.read()

if 'Phase 2.11' in content:
    print("  ⚠️ มี Phase 2.11 อยู่แล้ว — ข้าม")
else:
    # เพิ่มหลัง Phase 2.10 entry
    phase_2_11 = '''
### Phase 2.11 — Subcategory UI Restored (2026-04-27 night)
- ✅ **CategoriesTab** — dropdown หมวดหลัก + tree view (📁 + ↳ indent)
- ✅ **ProductFormModal** — dropdown indent หมวดย่อยใต้หมวดหลัก (มีอยู่แล้ว)
- ✅ **StockPage filter** — cascade dropdown หมวดหลัก → หมวดย่อย (มีอยู่แล้ว)
- ⚠️ **บทเรียน:** UI subcategory เคยทำแล้วแต่หาย (`App.jsx.bak_subcategory` 0 bytes) → ก่อน patch ใหม่ต้อง grep verify ก่อนเสมอ ห้ามเชื่อ compaction summary

'''
    # หา marker — Phase 2.10 entry จบ (ก่อน "Backup & Tooling" หรือ "UX Improvements")
    marker = '#### ⚠️ บทเรียนสำคัญ Phase 2.10\n1.'
    if marker in content:
        # หาจุดจบของ Phase 2.10 (next blank line + non-list line)
        idx = content.find(marker)
        if idx >= 0:
            # หา "\n\n###" หรือ "\n\n###" ถัดไป
            next_section = content.find('\n\n### ', idx)
            if next_section > 0:
                content = content[:next_section] + '\n' + phase_2_11 + content[next_section:]
                with open('PROJECT_CONTEXT.md', 'w', encoding='utf-8') as f:
                    f.write(content)
                print("  ✅ เพิ่ม Phase 2.11 ใน PROJECT_CONTEXT.md")
            else:
                print("  ❌ หา next section ไม่เจอ")
    else:
        print("  ❌ ไม่พบ marker Phase 2.10 — ข้าม")
PYEOF

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Step 4: Cleanup PROJECT_CONTEXT_PATCH.md (ใช้แล้วทิ้ง)"
echo "═══════════════════════════════════════════════════════════"

if [ -f PROJECT_CONTEXT_PATCH.md ]; then
  rm PROJECT_CONTEXT_PATCH.md
  echo "  ✅ ลบ PROJECT_CONTEXT_PATCH.md (ไม่ใช้แล้ว)"
fi

# ลบ finalize.sh ด้วย — ใช้แล้วเช่นกัน
if [ -f finalize.sh ]; then
  rm finalize.sh
  echo "  ✅ ลบ finalize.sh (ใช้แล้ว)"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Step 5: Git commit + push"
echo "═══════════════════════════════════════════════════════════"

git add -A
echo ""
echo "  📋 ไฟล์ที่จะ commit:"
git status --short

echo ""
read -p "  ดำเนินการ commit + push ไหม? (y/N): " confirm
if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
  git commit -m "feat(stock): restore subcategory UI + lesson learned

Phase 2.11 — Subcategory UI Restored

UI:
- CategoriesTab: dropdown 'เพิ่มเป็นหมวดหลัก / เพิ่มในหมวด: X' + tree view
- ProductFormModal: dropdown indent (มีอยู่ก่อนแล้ว)
- StockPage filter: cascade หมวดหลัก → หมวดย่อย (มีอยู่ก่อนแล้ว)

Backend + DB ไม่ต้องแตะ:
- backend/src/routes/product-categories.js (รองรับ parent_id อยู่แล้ว)
- DB trigger trg_enforce_category_depth (จำกัด 2 ชั้น)

Cleanup:
- ลบ PROJECT_CONTEXT_PATCH.md, finalize.sh (ใช้แล้วทิ้ง)
- Update CHANGELOG.md, NEW_CHAT_TEMPLATE.md, PROJECT_CONTEXT.md

Lesson:
- compaction summary ไม่ใช่ source of truth
- ก่อน patch ใหม่ ต้อง grep verify code จริงก่อนเสมอ
"
  git push origin main
  echo ""
  echo "  ✅ Pushed to GitHub สำเร็จ"
else
  echo "  ⏸️  ข้าม commit"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ DONE"
echo "═══════════════════════════════════════════════════════════"
