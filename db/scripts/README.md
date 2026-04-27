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
