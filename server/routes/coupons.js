const express = require('express');
const db = require('../db');
const { auth, admin } = require('../middleware/auth');

const router = express.Router();

// POST /api/coupons/validate - Validate a coupon code and return discount info
router.post('/validate', auth, (req, res) => {
  const { code, subtotal } = req.body;
  if (!code) return res.status(400).json({ message: 'Coupon code is required' });

  const upperCode = String(code).toUpperCase().trim();
  db.get(
    'SELECT * FROM coupons WHERE code = ? AND active = 1',
    [upperCode],
    (err, coupon) => {
      if (err || !coupon) return res.status(400).json({ message: 'Invalid coupon code' });

      // Check expiry
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        return res.status(400).json({ message: 'Coupon has expired' });
      }
      // Check usage limit
      if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
        return res.status(400).json({ message: 'Coupon usage limit reached' });
      }
      // Check minimum order
      const orderAmount = Number(subtotal) || 0;
      if (orderAmount < (coupon.min_order_amount || 0)) {
        return res.status(400).json({
          message: `Minimum order of ₹${coupon.min_order_amount} required for this coupon`
        });
      }

      // Calculate discount
      let discount = coupon.discount_type === 'percent'
        ? (orderAmount * coupon.discount_value) / 100
        : coupon.discount_value;

      // Cap at max_discount_amount if set
      if (coupon.max_discount_amount && discount > coupon.max_discount_amount) {
        discount = coupon.max_discount_amount;
      }

      // Cap at subtotal
      discount = Math.min(discount, orderAmount);

      res.json({
        valid: true,
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        discount: Math.round(discount * 100) / 100
      });
    }
  );
});

// POST /api/coupons - Create a coupon (admin only)
router.post('/', auth, admin, (req, res) => {
  const { code, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, expires_at } = req.body;

  if (!code || !discount_type || !discount_value) {
    return res.status(400).json({ message: 'Code, discount_type, and discount_value are required' });
  }
  if (!['percent', 'flat'].includes(discount_type)) {
    return res.status(400).json({ message: 'discount_type must be "percent" or "flat"' });
  }
  if (Number(discount_value) <= 0) {
    return res.status(400).json({ message: 'discount_value must be positive' });
  }
  if (discount_type === 'percent' && Number(discount_value) > 100) {
    return res.status(400).json({ message: 'Percent discount cannot exceed 100' });
  }

  const upperCode = String(code).toUpperCase().trim();
  db.run(
    `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [upperCode, discount_type, Number(discount_value), Number(min_order_amount) || 0, Number(max_discount_amount) || null, Number(usage_limit) || null, expires_at || null],
    function (err) {
      if (err) {
        if (err.message && err.message.includes('UNIQUE')) {
          return res.status(409).json({ message: 'Coupon code already exists' });
        }
        return res.status(500).json({ message: 'Server error' });
      }
      db.get('SELECT * FROM coupons WHERE id = ?', [this.lastID], (getErr, coupon) => {
        res.status(201).json({ message: 'Coupon created', coupon });
      });
    }
  );
});

// GET /api/coupons - List all coupons (admin only)
router.get('/', auth, admin, (req, res) => {
  db.all('SELECT * FROM coupons ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    res.json({ coupons: rows || [] });
  });
});

// PUT /api/coupons/:id - Update coupon (admin only)
router.put('/:id', auth, admin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid coupon id' });

  const { active, discount_value, min_order_amount, max_discount_amount, usage_limit, expires_at } = req.body;

  db.get('SELECT * FROM coupons WHERE id = ?', [id], (err, existing) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!existing) return res.status(404).json({ message: 'Coupon not found' });

    db.run(
      `UPDATE coupons SET active = ?, discount_value = ?, min_order_amount = ?,
       max_discount_amount = ?, usage_limit = ?, expires_at = ? WHERE id = ?`,
      [
        active !== undefined ? (active ? 1 : 0) : existing.active,
        discount_value !== undefined ? Number(discount_value) : existing.discount_value,
        min_order_amount !== undefined ? Number(min_order_amount) : existing.min_order_amount,
        max_discount_amount !== undefined ? Number(max_discount_amount) : existing.max_discount_amount,
        usage_limit !== undefined ? Number(usage_limit) : existing.usage_limit,
        expires_at !== undefined ? expires_at : existing.expires_at,
        id
      ],
      (updateErr) => {
        if (updateErr) return res.status(500).json({ message: 'Server error' });
        db.get('SELECT * FROM coupons WHERE id = ?', [id], (getErr, coupon) => {
          res.json({ message: 'Coupon updated', coupon });
        });
      }
    );
  });
});

// DELETE /api/coupons/:id - Delete coupon (admin only)
router.delete('/:id', auth, admin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid coupon id' });
  db.run('DELETE FROM coupons WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    res.json({ message: 'Coupon deleted' });
  });
});

module.exports = router;
