const express = require('express');
const db = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/invoice/:orderId - Generate a printable invoice (HTML)
router.get('/:orderId', auth, (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!orderId) return res.status(400).json({ message: 'Invalid order id' });

  db.get('SELECT o.*, u.name as customer_name, u.email as customer_email FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?', [orderId], (err, order) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Non-admins can only see their own orders
    if (!req.user.is_admin && order.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    let items = [];
    try { items = JSON.parse(order.items || '[]'); } catch (_) { items = []; }

    const fmt = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    const subtotal = items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0);

    const itemsHtml = items.map((item) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee">${item.name || ''}</td>
        <td style="text-align:center;padding:10px;border-bottom:1px solid #eee">${item.quantity || 1}</td>
        <td style="text-align:right;padding:10px;border-bottom:1px solid #eee">${fmt(item.price)}</td>
        <td style="text-align:right;padding:10px;border-bottom:1px solid #eee;font-weight:600">${fmt((item.price || 0) * (item.quantity || 1))}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html><head><title>Invoice #${order.id}</title>
<style>
  body{font-family:'Segoe UI',sans-serif;margin:40px;color:#333}
  @media print{body{margin:0}.no-print{display:none}}
  .header{display:flex;justify-content:space-between;border-bottom:3px solid #b8860b;padding-bottom:20px;margin-bottom:20px}
  .logo{font-size:24px;font-weight:700;color:#b8860b}
  table{width:100%;border-collapse:collapse;margin:20px 0}
  th{background:#f8f5f0;padding:10px;text-align:left;border-bottom:2px solid #b8860b}
  .totals{margin-top:20px;text-align:right}
  .totals div{padding:5px 0}
  .grand{font-size:20px;font-weight:700;color:#b8860b;border-top:2px solid #b8860b;padding-top:10px}
  .footer{text-align:center;margin-top:40px;color:#888;font-size:12px}
</style></head><body>
  <div class="header">
    <div><div class="logo">Jagmohini Paithani</div><div style="color:#888">Authentic Handwoven Sarees</div></div>
    <div style="text-align:right">
      <h2 style="margin:0">INVOICE</h2>
      <div><strong>#INV-${String(order.id).padStart(6, '0')}</strong></div>
      <div style="color:#888">${new Date(order.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
    </div>
  </div>
  <div style="display:flex;justify-content:space-between;margin-bottom:30px">
    <div>
      <h3 style="margin:0 0 5px">Bill To:</h3>
      <div>${order.customer_name}</div>
      <div style="color:#666">${order.customer_email}</div>
      <div style="color:#666;margin-top:5px">${(order.shipping_address || '').replace(/\n/g, '<br>')}</div>
      ${order.phone ? `<div style="color:#666">Phone: ${order.phone}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div><strong>Payment:</strong> ${(order.payment_method || 'cod').toUpperCase()}</div>
      <div><strong>Status:</strong> ${order.status}</div>
      <div><strong>Payment:</strong> ${order.payment_status}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <div class="totals">
    <div>Subtotal: ${fmt(subtotal)}</div>
    <div>Shipping: FREE</div>
    <div class="grand">Total: ${fmt(order.total)}</div>
  </div>
  <div class="footer">
    <p>Thank you for shopping with Jagmohini Paithani!</p>
    <p>For queries, contact us at the number listed on our website.</p>
  </div>
  <div class="no-print" style="text-align:center;margin-top:20px">
    <button onclick="window.print()" style="padding:10px 30px;background:#b8860b;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:16px">Print Invoice</button>
  </div>
</body></html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });
});

module.exports = router;
