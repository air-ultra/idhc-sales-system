const express = require('express');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

async function genPONumber() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const result = await query("SELECT nextval('po_number_seq') AS seq");
  return `PO${yyyy}${mm}${String(result.rows[0].seq).padStart(4, '0')}`;
}

// LIST
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, supplier_id, year } = req.query;
    let sql = `SELECT po.*, s.name AS supplier_name, s.code AS supplier_code,
                      u.username AS created_by_name
               FROM purchase_orders po
               LEFT JOIN suppliers s ON po.supplier_id = s.id
               LEFT JOIN users u ON po.created_by = u.id
               WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); sql += ` AND po.status = $${params.length}`; }
    if (supplier_id) { params.push(supplier_id); sql += ` AND po.supplier_id = $${params.length}`; }
    if (year) { params.push(year); sql += ` AND EXTRACT(YEAR FROM po.po_date) = $${params.length}`; }
    sql += ' ORDER BY po.created_at DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET BY ID (with items)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const po = await query(
      `SELECT po.*, s.name AS supplier_name, s.code AS supplier_code,
              u.username AS created_by_name
       FROM purchase_orders po
       LEFT JOIN suppliers s ON po.supplier_id = s.id
       LEFT JOIN users u ON po.created_by = u.id
       WHERE po.id = $1`, [req.params.id]);
    if (!po.rows.length) return res.status(404).json({ error: 'ไม่พบใบสั่งซื้อ' });
    
    const items = await query(
      `SELECT pi.*, p.product_code, p.name AS product_name
       FROM po_items pi
       LEFT JOIN products p ON pi.product_id = p.id
       WHERE pi.po_id = $1 ORDER BY pi.id`, [req.params.id]);
    
    const approvals = await query(
      `SELECT pa.*, u.username
       FROM po_approvals pa
       LEFT JOIN users u ON pa.approved_by = u.id
       WHERE pa.po_id = $1 ORDER BY pa.created_at`, [req.params.id]);
    
    res.json({ ...po.rows[0], items: items.rows, approvals: approvals.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// CREATE
router.post('/', authenticate, async (req, res) => {
  try {
    const d = req.body;
    const po_number = await genPONumber();
    
    // Calculate totals from items
    let total_amount = 0;
    if (d.items) {
      d.items.forEach(item => { total_amount += (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0); });
    }
const vat_rate = d.vat_rate !== undefined ? parseFloat(d.vat_rate) : 7;
    const vat_amount = total_amount * vat_rate / 100;
    const grand_total = total_amount + vat_amount;
    
    const result = await query(`
      INSERT INTO purchase_orders (po_number, supplier_id, po_date, expected_date, total_amount, vat_rate, vat_amount, grand_total, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
    `, [po_number, d.supplier_id, d.po_date || new Date(), d.expected_date || null,
        total_amount, vat_rate, vat_amount, grand_total, d.notes || '', req.user.id]);
    
    const po_id = result.rows[0].id;
    
    // Insert items
    if (d.items && d.items.length) {
      for (const item of d.items) {
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.unit_price) || 0;
        await query(`
          INSERT INTO po_items (po_id, product_id, unit, quantity, unit_price, total_price)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [po_id, item.product_id, item.unit || 'ชิ้น', qty, price, qty * price]);
      }
    }
    
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// UPDATE (draft only)
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const existing = await query('SELECT status FROM purchase_orders WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'ไม่พบใบสั่งซื้อ' });
    if (existing.rows[0].status !== 'draft') return res.status(400).json({ error: 'แก้ไขได้เฉพาะร่าง' });
    
    const d = req.body;
    
    // Recalculate totals if items provided
    let total_amount = parseFloat(d.total_amount) || 0;
    if (d.items) {
      total_amount = 0;
      d.items.forEach(item => { total_amount += (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0); });
    }
const vat_rate = d.vat_rate !== undefined ? parseFloat(d.vat_rate) : 7;
    const vat_amount = total_amount * vat_rate / 100;
    const grand_total = total_amount + vat_amount;
    
    await query(`
      UPDATE purchase_orders SET
        supplier_id = COALESCE($1, supplier_id),
        po_date = COALESCE($2, po_date),
        expected_date = COALESCE($3, expected_date),
        total_amount = $4, vat_rate = $5, vat_amount = $6, grand_total = $7,
        notes = COALESCE($8, notes),
        updated_at = NOW()
      WHERE id = $9
    `, [d.supplier_id, d.po_date, d.expected_date, total_amount, vat_rate, vat_amount, grand_total, d.notes, req.params.id]);
    
    // Update items
    if (d.items) {
      await query('DELETE FROM po_items WHERE po_id = $1', [req.params.id]);
      for (const item of d.items) {
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.unit_price) || 0;
        await query(`
          INSERT INTO po_items (po_id, product_id, unit, quantity, unit_price, total_price)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [req.params.id, item.product_id, item.unit || 'ชิ้น', qty, price, qty * price]);
      }
    }
    
    const updated = await query('SELECT * FROM purchase_orders WHERE id = $1', [req.params.id]);
    res.json(updated.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// APPROVE
router.post('/:id/approve', authenticate, async (req, res) => {
  try {
    const result = await query(`
      UPDATE purchase_orders SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
      WHERE id = $2 AND status = 'draft' RETURNING *
    `, [req.user.id, req.params.id]);
    if (!result.rows.length) return res.status(400).json({ error: 'ไม่สามารถอนุมัติได้' });
    
    await query(`INSERT INTO po_approvals (po_id, approved_by, action, comment) VALUES ($1, $2, 'approved', $3)`,
      [req.params.id, req.user.id, req.body.comment || '']);
    
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// RECEIVE GOODS (approved → received, update stock)
router.post('/:id/receive', authenticate, async (req, res) => {
  try {
    const po = await query('SELECT * FROM purchase_orders WHERE id = $1', [req.params.id]);
    if (!po.rows.length) return res.status(404).json({ error: 'ไม่พบใบสั่งซื้อ' });
    if (po.rows[0].status !== 'approved') return res.status(400).json({ error: 'ต้องอนุมัติก่อนรับสินค้า' });
    
    const receivedItems = req.body.items || [];
    const poItems = await query('SELECT * FROM po_items WHERE po_id = $1', [req.params.id]);
    
    for (const poItem of poItems.rows) {
      const recv = receivedItems.find(r => r.po_item_id === poItem.id);
      const recvQty = recv ? parseFloat(recv.quantity) : parseFloat(poItem.quantity);
      
      if (recvQty <= 0) continue;
      
      // Update PO item received qty
      await query('UPDATE po_items SET received_qty = received_qty + $1 WHERE id = $2', [recvQty, poItem.id]);
      
      // Update product stock
      const product = await query('SELECT stock_qty FROM products WHERE id = $1', [poItem.product_id]);
      const before = parseFloat(product.rows[0].stock_qty);
      const after = before + recvQty;
      
      await query('UPDATE products SET stock_qty = $1, updated_at = NOW() WHERE id = $2', [after, poItem.product_id]);
      
      // Record stock movement
      await query(`
        INSERT INTO stock_movements (product_id, movement_type, quantity, before_qty, after_qty, reference_type, reference_id, notes, created_by)
        VALUES ($1, 'in', $2, $3, $4, 'po', $5, $6, $7)
      `, [poItem.product_id, recvQty, before, after, req.params.id, `รับจาก PO ${po.rows[0].po_number}`, req.user.id]);
    }
    
    // Update PO status
    await query("UPDATE purchase_orders SET status = 'received', updated_at = NOW() WHERE id = $1", [req.params.id]);
    
    await query(`INSERT INTO po_approvals (po_id, approved_by, action, comment) VALUES ($1, $2, 'received', $3)`,
      [req.params.id, req.user.id, req.body.comment || 'รับสินค้าเรียบร้อย']);
    
    res.json({ message: 'รับสินค้าเรียบร้อย' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE (draft only)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await query("DELETE FROM purchase_orders WHERE id = $1 AND status = 'draft' RETURNING id", [req.params.id]);
    if (!result.rows.length) return res.status(400).json({ error: 'ลบได้เฉพาะร่าง' });
    res.json({ message: 'ลบสำเร็จ' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
