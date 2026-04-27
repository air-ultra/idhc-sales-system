#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# IDHC Sales System — Phase 2.10 Finalization Script
# ═══════════════════════════════════════════════════════════════
# รันสคริปต์นี้ใน VM ที่ /home/IDEA-HOUSE/sales-system/
# จะทำ: ย้ายไฟล์ → commit/push git → setup volume mount
# ═══════════════════════════════════════════════════════════════

set -e  # exit on error

cd /home/IDEA-HOUSE/sales-system

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Phase A: ย้ายไฟล์ db scripts ไป db/scripts/"
echo "═══════════════════════════════════════════════════════════"

mkdir -p db/scripts

# ย้ายเฉพาะถ้ายังไม่ถูกย้าย
[ -f create_admin_user.sql ] && git mv create_admin_user.sql db/scripts/ 2>/dev/null || \
  ([ -f create_admin_user.sql ] && mv create_admin_user.sql db/scripts/) || \
  echo "  - create_admin_user.sql: ย้ายแล้ว หรือไม่มี"

[ -f reset_data.sql ] && git mv reset_data.sql db/scripts/ 2>/dev/null || \
  ([ -f reset_data.sql ] && mv reset_data.sql db/scripts/) || \
  echo "  - reset_data.sql: ย้ายแล้ว หรือไม่มี"

# สร้าง README ใน db/scripts/
cat > db/scripts/README.md << 'EOF'
# Database Maintenance Scripts

⚠️ **คำเตือน:** สคริปต์ใน folder นี้ส่งผลต่อข้อมูลใน database โดยตรง — ใช้ด้วยความระมัดระวัง

## Files

| File | Purpose | Frequency |
|---|---|---|
| `create_admin_user.sql` | สร้าง admin user (`admin`/`admin123`) — ใช้หลัง reset | ครั้งคราว |
| `reset_data.sql` | **ลบข้อมูลทั้งหมด** (PO, WHT, Stock, Staff, Payroll) เก็บแค่ users/roles | **อันตราย** |

## วิธีใช้

```bash
cd /home/IDEA-HOUSE/sales-system

# กู้ admin user หลัง reset
docker compose exec -T sales-db psql -U sales_admin -d sales_system < db/scripts/create_admin_user.sql

# ⚠️ Reset ข้อมูล (ใช้เฉพาะตอน setup ระบบใหม่ / dev)
docker compose exec -T sales-db psql -U sales_admin -d sales_system < db/scripts/reset_data.sql
```

## Workflow ปกติหลัง reset_data

1. รัน `reset_data.sql` (ลบข้อมูล)
2. รัน `create_admin_user.sql` (กู้ admin)
3. Login เข้าระบบด้วย `admin` / `admin123`
4. เปลี่ยน password ทันที!
EOF

echo "  ✅ ย้ายไฟล์ + สร้าง db/scripts/README.md"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Phase B: Update docs"
echo "═══════════════════════════════════════════════════════════"

# CHANGELOG.md และ NEW_CHAT_TEMPLATE.md จะถูก upload จาก WinSCP ทับเอง
# (ดูคำสั่งด้านล่างหลังรันสคริปต์นี้)
echo "  ⚠️ ต้อง upload ไฟล์เหล่านี้ผ่าน WinSCP ก่อนรันสคริปต์นี้:"
echo "      - CHANGELOG.md (ใหม่)"
echo "      - NEW_CHAT_TEMPLATE.md (อัปเดต ทับของเดิม)"
echo "      - PROJECT_CONTEXT_PATCH.md (อ่าน manual patch ใส่ใน PROJECT_CONTEXT.md)"
echo ""

if [ ! -f CHANGELOG.md ]; then
  echo "  ❌ ไม่พบ CHANGELOG.md — upload ก่อนแล้วรันใหม่"
  exit 1
fi

echo "  ✅ พบไฟล์ docs ทั้งหมด"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Phase C: Setup volume mount (dev hot-reload)"
echo "═══════════════════════════════════════════════════════════"

# Backup docker-compose ก่อน
cp docker-compose.yml docker-compose.yml.bak.before-volume-mount

# ตรวจว่ามี volume mount แล้วหรือยัง
if grep -q "/app/src" docker-compose.yml; then
  echo "  ⚠️ docker-compose.yml มี volume mount ของ /app/src แล้ว — ข้าม"
else
  # ใช้ python แก้ YAML ให้ปลอดภัย
  python3 << 'PYEOF'
import re
with open('docker-compose.yml', 'r') as f:
    content = f.read()

# หา service sales-api และเพิ่ม volume
# Pattern: หา block ของ sales-api แล้วใส่ volumes ถ้ายังไม่มี
# ใช้วิธีง่าย: หา "sales-api:" แล้วถ้าใน block นั้นไม่มี volumes ก็เพิ่ม

# หาจุดที่จะแทรก — หลัง build: หรือ image: ใน sales-api block
pattern = r'(  sales-api:\s*\n(?:    [^\n]*\n)*)'
match = re.search(pattern, content)
if match:
    block = match.group(1)
    if 'volumes:' in block:
        # มี volumes แล้ว — เพิ่ม src mount เข้าไป
        new_block = re.sub(
            r'(    volumes:\s*\n)',
            r'\1      - ./backend/src:/app/src\n',
            block,
            count=1
        )
    else:
        # ยังไม่มี volumes — เพิ่มทั้ง section
        new_block = block.rstrip() + '\n    volumes:\n      - ./backend/src:/app/src\n'
    content = content.replace(block, new_block, 1)
    with open('docker-compose.yml', 'w') as f:
        f.write(content)
    print("  ✅ เพิ่ม volume mount สำเร็จ")
else:
    print("  ❌ ไม่พบ sales-api service ใน docker-compose.yml")
PYEOF
fi

echo ""
echo "  📋 ดู docker-compose.yml ส่วน sales-api ตอนนี้:"
grep -A 8 "^  sales-api:" docker-compose.yml || echo "  (ไม่พบ — เช็คเอง)"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Phase D: Git operations"
echo "═══════════════════════════════════════════════════════════"

git add -A
echo ""
echo "  📋 ไฟล์ที่จะ commit:"
git status --short

echo ""
read -p "  ดำเนินการ commit + push ไหม? (y/N): " confirm
if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
  git commit -m "feat(payroll): documents export + unapprove + WeasyPrint migration

Phase 2.10 — Payroll Documents & Workflow

Added:
- รายงานเงินเดือน Excel/PDF (แบ่ง 3 กลุ่ม: รายเดือน/รายสัญญาจ้าง/รายวัน)
- สลิปเงินเดือน PDF (2 สลิป/หน้า + ยอดสุทธิเป็นตัวอักษรไทย)
- สปส. 1-10 PDF (สำหรับเก็บแฟ้ม)
- สปส. 1-10 Excel (format e-Filing)
- ปุ่ม unapprove payroll (approved → draft)
- ปุ่ม Export 5 ตัวในหน้า Payroll
- Department CRUD route (จาก phase ก่อน — commit ค้าง)

Changed:
- PDF engine: ReportLab → WeasyPrint (HarfBuzz fix Thai shaping)
- ย้าย db scripts ไปที่ db/scripts/ พร้อม README

Infrastructure:
- เพิ่ม dependency exceljs ^4.4.0
- Register routes payroll-export + payroll-documents
- เพิ่ม volume mount /app/src ใน sales-api (dev hot-reload)

Docs:
- เพิ่ม CHANGELOG.md
- Update NEW_CHAT_TEMPLATE.md (เพิ่ม WeasyPrint rule + 3-layer check tip)
- Update PROJECT_CONTEXT.md (enum values, PDF pattern, payroll endpoints)
"
  git push origin main
  echo ""
  echo "  ✅ Pushed to GitHub สำเร็จ"
else
  echo "  ⏸️  ข้าม commit (พี่ commit เองทีหลังได้)"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Phase E: Restart container ใช้ volume mount"
echo "═══════════════════════════════════════════════════════════"

read -p "  Rebuild + restart container ไหม? (y/N): " confirm2
if [ "$confirm2" = "y" ] || [ "$confirm2" = "Y" ]; then
  docker compose down sales-api
  docker rmi $(docker images -q sales-system-sales-api 2>/dev/null) 2>/dev/null || true
  docker compose up -d --build sales-api
  sleep 5
  docker compose logs --tail 15 sales-api
  echo ""
  echo "  ✅ Container ขึ้นแล้ว — volume mount พร้อมใช้งาน"
  echo ""
  echo "  📌 ต่อไปนี้ แก้ไฟล์ใน backend/src/ → restart พอ ไม่ต้อง rebuild"
  echo "      docker compose restart sales-api"
else
  echo "  ⏸️  ข้าม restart (พี่ทำเองได้ทีหลัง)"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ DONE"
echo "═══════════════════════════════════════════════════════════"
