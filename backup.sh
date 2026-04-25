#!/bin/bash
# IDHC Sales System — Full Backup Script

set -e
cd /home/IDEA-HOUSE/sales-system/

TIMESTAMP=$(date +%Y%m%d_%H%M)
BACKUP_DIR="$HOME/sales-system-backups"
mkdir -p "$BACKUP_DIR"

echo "════════════════════════════════════════"
echo " 📦 IDHC Backup — $TIMESTAMP"
echo "════════════════════════════════════════"

# 1. DB backup
echo ""
echo "🗄️  [1/4] DB backup..."
docker compose exec -T sales-db pg_dump -U sales_admin sales_system > "$BACKUP_DIR/db_${TIMESTAMP}.sql"
echo "   ✓ db_${TIMESTAMP}.sql ($(du -h "$BACKUP_DIR/db_${TIMESTAMP}.sql" | cut -f1))"

# 2. Tar source
echo ""
echo "📁 [2/4] Tar source code..."
tar --exclude='./node_modules' --exclude='./*/node_modules' --exclude='./.git' \
    --exclude='./backup_*.sql' --exclude='./*.bak' --exclude='./*/*.bak' \
    --exclude='./*/*/*.bak' \
    -czf "$BACKUP_DIR/source_${TIMESTAMP}.tar.gz" -C /home/IDEA-HOUSE sales-system
echo "   ✓ source_${TIMESTAMP}.tar.gz ($(du -h "$BACKUP_DIR/source_${TIMESTAMP}.tar.gz" | cut -f1))"

# 3. Cleanup junk
echo ""
echo "🧹 [3/4] Cleanup junk files..."
JUNK="$BACKUP_DIR/junk_${TIMESTAMP}"
mkdir -p "$JUNK"
[ -f backend/src/routes/purchaseOrders.js.bak ] && mv backend/src/routes/purchaseOrders.js.bak "$JUNK/" && echo "   ✓ moved purchaseOrders.js.bak"
[ -f frontend/src/App.jsx.bak ] && mv frontend/src/App.jsx.bak "$JUNK/" && echo "   ✓ moved App.jsx.bak"
[ -f patch_po_description.py ] && mv patch_po_description.py "$JUNK/" && echo "   ✓ moved patch_po_description.py"
for f in backup_*.sql; do
    [ -f "$f" ] && mv "$f" "$BACKUP_DIR/" && echo "   ✓ moved $f"
done

# 4. .gitignore
echo ""
echo "📝 [4/4] Update .gitignore..."
add_to_gitignore() {
    local pattern="$1"
    if ! grep -qxF "$pattern" .gitignore 2>/dev/null; then
        echo "$pattern" >> .gitignore
        echo "   ✓ added: $pattern"
    fi
}
touch .gitignore
add_to_gitignore "# Backups and temp files"
add_to_gitignore "*.bak"
add_to_gitignore "backup_*.sql"
add_to_gitignore "patch_*.py"
add_to_gitignore ""
add_to_gitignore "# Unused legacy fonts (kept in VM only)"
add_to_gitignore "backend/src/fonts/THSarabunNew*.ttf"

echo ""
echo "════════════════════════════════════════"
echo " ✅ Backup complete!"
echo "════════════════════════════════════════"
echo ""
echo "📂 Backup files:"
ls -lh "$BACKUP_DIR" | tail -10
