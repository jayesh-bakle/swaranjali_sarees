const express = require('express');
const db = require('../db');
const { auth } = require('../middleware/auth');
const { appendOrderToSheet } = require('../utils/googleSheet');
const { sendOrderConfirmation } = require('../utils/email');
const { issueRefund } = require('../utils/razorpay');
const { sendOrderWhatsApp } = require('../utils/whatsapp');

const router = express.Router();

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];
const PAYMENT_METHODS = ['cod', 'cash', 'razorpay'];

// Allowed status transitions (cancelled & delivered are terminal)
const STATUS_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered'],
  delivered: [],
  cancelled: [],
};

const MAX_QUANTITY = 50; // per line-item sanity cap

// Helper: Add tracking timeline entry (never crashes the request)
const addTracking = (orderId, status, note = '', location = '') => {
  db.run(
    'INSERT INTO order_tracking (order_id, status, note, location) VALUES (?, ?, ?, ?)',
    [orderId, status, note, location],
    (err) => {
      if (err) console.error('Tracking insert error:', err.message);
    }
  );
};

// Helper: Get order with items parsed safely (malformed JSON must never crash the process)
const formatOrder = (order) => {
  if (!order) return null;
  let items = [];
  try {
    items = JSON.parse(order.items || '[]');
  } catch (_) {
    items = [];
  }
  return { ...order, items };
};

// Validate + normalize an items payload into [{ id, quantity }] with duplicates merged
const normalizeItems = (rawItems) => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { error: 'Order must contain at least one item' };
  }
  const merged = new Map();
  for (const raw of rawItems) {
    const id = Number(raw && raw.id);
    const quantity = Number(raw && raw.quantity);
    if (!Number.isInteger(id) || id <= 0) {
      return { error: 'Each item must have a valid product id' };
    }
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_QUANTITY) {
      return { error: `Quantity must be a whole number between 1 and ${MAX_QUANTITY}` };
    }
    merged.set(id, (merged.get(id) || 0) + quantity);
  }
  return { items: [...merged.entries()].map(([id, quantity]) => ({ id, quantity })) };
};

// Restore stock for a set of items (rolls back a partially-created order)
const restoreStock = (items, cb) => {
  let i = 0;
  const step = (err) => {
    if (err) console.error('Stock restore error:', err.message);
    if (i >= items.length) return cb();
    const item = items[i++];
    db.run('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.id], step);
  };
  step(null);
};

// POST /api/orders - Create a new order (regular users only)
router.post('/', auth, (req, res) => {
  // Admin cannot place orders — they manage the store
  if (req.user.is_admin) {
    return res.status(403).json({ message: 'Admins manage the store. Only customers can place orders.' });
  }

  const { shipping_address, phone, payment_method, coupon_code } = req.body;

  if (!shipping_address || !String(shipping_address).trim()) {
    return res.status(400).json({ message: 'Shipping address is required' });
  }

  const paymentMethod = (payment_method || 'cod').toLowerCase();
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ message: `payment_method must be one of: ${PAYMENT_METHODS.join(', ')}` });
  }

  const normalized = normalizeItems(req.body.items);
  if (normalized.error) return res.status(400).json({ message: normalized.error });
  const items = normalized.items;

  // Fetch authoritative prices + names from the DB (client prices are never trusted)
  db.all(
    `SELECT id, name, price, sale_price, stock FROM products WHERE id IN (${items.map(() => '?').join(',')})`,
    items.map((i) => i.id),
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Server error' });

      const byId = new Map(rows.map((r) => [r.id, r]));
      const missing = items.find((i) => !byId.has(i.id));
      if (missing) {
        return res.status(400).json({ message: `Product not found: id ${missing.id}` });
      }

      const overStock = items.find((i) => byId.get(i.id).stock < i.quantity);
      if (overStock) {
        const p = byId.get(overStock.id);
        return res.status(400).json({ message: `Not enough stock for ${p.name}. Only ${p.stock} left.` });
      }

      // Reserve stock with an atomic guarded update. If any line loses the race,
      // release everything already reserved and reject the whole order.
      const reserved = [];
      let i = 0;

      // Apply a coupon discount if a valid code was supplied (server-side, never trusted from client)
      const applyCoupon = (subtotal, cb) => {
        if (!coupon_code) return cb(0);
        const upperCode = String(coupon_code).toUpperCase().trim();
        db.get('SELECT * FROM coupons WHERE code = ? AND active = 1', [upperCode], (err, coupon) => {
          if (err || !coupon) return cb(0);
          if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return cb(0);
          if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) return cb(0);
          if (subtotal < (coupon.min_order_amount || 0)) return cb(0);
          let discount = coupon.discount_type === 'percent'
            ? (subtotal * coupon.discount_value) / 100
            : coupon.discount_value;
          if (coupon.max_discount_amount && discount > coupon.max_discount_amount) discount = coupon.max_discount_amount;
          discount = Math.min(discount, subtotal);
          // Increment usage counter
          db.run('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [coupon.id], () => {});
          return cb(Math.round(discount * 100) / 100);
        });
      };

      const createOrder = () => {
        // Recompute the subtotal from server-side prices
        const subtotal = items.reduce((sum, item) => {
          const p = byId.get(item.id);
          return sum + (p.sale_price != null ? p.sale_price : p.price) * item.quantity;
        }, 0);

        applyCoupon(subtotal, (discount) => {
          const total = Math.max(0, subtotal - discount);

          // Razorpay orders start 'pending' — they're only marked paid after a verified payment.
          const orderStatus = paymentMethod === 'razorpay' ? 'pending' : 'confirmed';
          const orderItems = items.map((item) => {
            const p = byId.get(item.id);
            return {
              id: p.id,
              name: p.name,
              price: p.sale_price != null ? p.sale_price : p.price,
              quantity: item.quantity,
            };
          });

          db.run(
            `INSERT INTO orders (user_id, items, total, shipping_address, phone, status, payment_status, payment_method)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, JSON.stringify(orderItems), total, String(shipping_address).trim(), phone || '', orderStatus, 'pending', paymentMethod],
            function (insertErr) {
              if (insertErr) {
                restoreStock(items, () => res.status(500).json({ message: 'Server error' }));
                return;
              }

              const orderId = this.lastID;

              // Insert into the normalized order_items table (used for aggregation reports)
              const itemStmt = 'INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)';
              orderItems.forEach((item) => {
                db.run(itemStmt, [orderId, item.id, item.name, item.quantity, item.price], (err) => {
                  if (err) console.error('order_items insert error:', err.message);
                });
              });

              // Rebuild FTS index for new/updated products (fire-and-forget)
              db.run("INSERT INTO products_fts(products_fts) VALUES('rebuild')", () => {});

              addTracking(orderId, orderStatus, paymentMethod === 'cod' ? 'Order placed. Pay on delivery.' : 'Order placed. Awaiting payment confirmation.');

              // Best-effort order logging + email + WhatsApp (never blocks or fails the request)
              db.get('SELECT name, email FROM users WHERE id = ?', [req.user.id], (userErr, userRow) => {
                const orderSummary = { id: orderId, total, shipping_address, payment_method: paymentMethod, status: orderStatus };
                appendOrderToSheet(
                  { ...orderSummary, phone: phone || '', payment_status: 'pending' },
                  orderItems,
                  userRow || {}
                ).catch(() => {});
                sendOrderConfirmation({ order: orderSummary, items: orderItems, customer: userRow || {} });
                sendOrderWhatsApp(orderSummary, orderItems, { name: userRow?.name || '', phone: phone || '' });
              });

              db.get('SELECT * FROM orders WHERE id = ?', [orderId], (getErr, order) => {
                if (getErr) return res.status(500).json({ message: 'Server error' });
                res.status(201).json({ message: 'Order placed successfully!', order: formatOrder(order) });
              });
            }
          );
        });
      };

      const reserveNext = (updateErr, changes) => {
        if (updateErr) {
          restoreStock(reserved, () => res.status(500).json({ message: 'Server error' }));
          return;
        }
        if (i > 0 && changes === 0) {
          // This line lost the race — release what we reserved
          const failed = items[i - 1];
          restoreStock(reserved, () => {
            const p = byId.get(failed.id);
            return res.status(400).json({ message: `Not enough stock for ${p.name}. Only ${p.stock} left.` });
          });
          return;
        }
        if (i >= items.length) return createOrder();
        const item = items[i++];
        db.run(
          'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
          [item.quantity, item.id, item.quantity],
          function (e) {
            if (!e && this.changes === 1) reserved.push(item);
            reserveNext(e, this.changes);
          }
        );
      };

      reserveNext(null, 0);
    }
  );
});

// GET /api/orders - Get my orders (regular users), all orders for admins
router.get('/', auth, (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  let where = '1=1';
  const params = [];
  if (!req.user.is_admin) {
    where += ' AND user_id = ?';
    params.push(req.user.id);
  }

  db.get(`SELECT COUNT(*) as count FROM orders WHERE ${where}`, params, (countErr, countRow) => {
    if (countErr) return res.status(500).json({ message: 'Server error' });
    db.all(
      `SELECT * FROM orders WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
      (err, rows) => {
        if (err) return res.status(500).json({ message: 'Server error' });
        const orders = rows.map(formatOrder);
        res.json({ orders, total: countRow?.count || 0, page, limit });
      }
    );
  });
});

// GET /api/orders/all - Get all orders (admin only)
router.get('/all', auth, (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  db.get('SELECT COUNT(*) as count FROM orders', (countErr, countRow) => {
    if (countErr) return res.status(500).json({ message: 'Server error' });
    db.all(
      `SELECT o.*, u.name as customer_name, u.email as customer_email FROM orders o
       JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset],
      (err, rows) => {
        if (err) return res.status(500).json({ message: 'Server error' });
        const orders = rows.map(formatOrder);
        res.json({ orders, total: countRow?.count || 0, page, limit });
      }
    );
  });
});

// GET /api/orders/:id - Get single order with tracking (own order or admin)
router.get('/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid order id' });

  db.get('SELECT * FROM orders WHERE id = ?', [id], (err, order) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Regular users can only access their own orders
    if (!req.user.is_admin && order.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    db.all('SELECT * FROM order_tracking WHERE order_id = ? ORDER BY updated_at ASC', [id], (trackErr, tracking) => {
      if (trackErr) return res.status(500).json({ message: 'Server error' });

      db.all('SELECT * FROM payments WHERE order_id = ?', [id], (payErr, payments) => {
        if (payErr) return res.status(500).json({ message: 'Server error' });

        if (req.user.is_admin) {
          db.get('SELECT id, name, email FROM users WHERE id = ?', [order.user_id], (userErr, customer) => {
            if (userErr) return res.status(500).json({ message: 'Server error' });
            res.json({ order: formatOrder(order), tracking, payments, customer });
          });
        } else {
          res.json({ order: formatOrder(order), tracking, payments });
        }
      });
    });
  });
});

// PUT /api/orders/cancel/:id - Cancel own order (customer)
router.put('/cancel/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid order id' });
  if (req.user.is_admin) {
    return res.status(403).json({ message: 'Customers can cancel orders. Admins should update status from admin panel.' });
  }

  db.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [id, req.user.id], (err, existingOrder) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!existingOrder) return res.status(404).json({ message: 'Order not found' });

    const cancellable = ['pending', 'confirmed', 'processing'];
    if (!cancellable.includes(existingOrder.status)) {
      return res.status(400).json({ message: `Order cannot be cancelled in "${existingOrder.status}" status` });
    }

    const orderItems = formatOrder(existingOrder).items;
    restoreStock(orderItems, () => {
      db.run('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['cancelled', id], (updateErr) => {
        if (updateErr) return res.status(500).json({ message: 'Server error' });
        addTracking(id, 'cancelled', 'Order cancelled by customer.');

        if (existingOrder.payment_status === 'paid') {
          // Issue a real refund (works in Razorpay test mode when keys are set)
          issueRefund(id, existingOrder.total, existingOrder.user_id).catch(() => {});
          db.run('UPDATE orders SET payment_status = ? WHERE id = ?', ['refunded', id], () => {});
        }

        db.get('SELECT * FROM orders WHERE id = ?', [id], (getErr, order) => {
          res.json({ message: 'Order cancelled!', order: formatOrder(order) });
        });
      });
    });
  });
});

// PUT /api/orders/:id/status - Update order status (admin only)
router.put('/:id/status', auth, (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  const id = Number(req.params.id);
  const { status, note, location } = req.body;

  if (!id) return res.status(400).json({ message: 'Invalid order id' });
  if (!status || !ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ message: `Status must be one of: ${ORDER_STATUSES.join(', ')}` });
  }

  db.get('SELECT * FROM orders WHERE id = ?', [id], (getOrderErr, existingOrder) => {
    if (getOrderErr) return res.status(500).json({ message: 'Server error' });
    if (!existingOrder) return res.status(404).json({ message: 'Order not found' });

    // Enforce a sane state machine — cancelled & delivered are terminal
    if (existingOrder.status !== status && !(STATUS_TRANSITIONS[existingOrder.status] || []).includes(status)) {
      return res.status(400).json({
        message: `Cannot move order from "${existingOrder.status}" to "${status}"`,
      });
    }

    const isNowCancelled = status === 'cancelled';

    db.run('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id], (err) => {
      if (err) return res.status(500).json({ message: 'Server error' });

      let statusNote = note || '';
      if (status === 'shipped' && !statusNote) statusNote = 'Order shipped from warehouse.';
      if (status === 'out_for_delivery' && !statusNote) statusNote = 'Out for delivery.';
      if (status === 'delivered' && !statusNote) statusNote = 'Delivered successfully.';
      if (status === 'cancelled' && !statusNote) statusNote = 'Order cancelled by admin.';
      addTracking(id, status, statusNote, location || '');

      if (isNowCancelled && existingOrder.status !== 'cancelled') {
        // Restore stock and issue a real refund if the order was paid
        const orderItems = formatOrder(existingOrder).items;
        restoreStock(orderItems, () => {
          if (existingOrder.payment_status === 'paid') {
            issueRefund(id, existingOrder.total, existingOrder.user_id).catch(() => {});
            db.run('UPDATE orders SET payment_status = ? WHERE id = ?', ['refunded', id], () => {});
          }
          db.get('SELECT * FROM orders WHERE id = ?', [id], (getErr, order) => {
            res.json({ message: 'Order updated successfully!', order: formatOrder(order) });
          });
        });
      } else {
        db.get('SELECT * FROM orders WHERE id = ?', [id], (getErr, order) => {
          res.json({ message: 'Order updated successfully!', order: formatOrder(order) });
        });
      }
    });
  });
});

// PUT /api/orders/:id/payment - Update payment status (admin only)
router.put('/:id/payment', auth, (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  const id = Number(req.params.id);
  const { payment_status } = req.body;

  if (!id) return res.status(400).json({ message: 'Invalid order id' });
  if (!payment_status || !PAYMENT_STATUSES.includes(payment_status)) {
    return res.status(400).json({ message: `Payment status must be one of: ${PAYMENT_STATUSES.join(', ')}` });
  }

  db.get('SELECT * FROM orders WHERE id = ?', [id], (err, order) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    db.run('UPDATE orders SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [payment_status, id], (updateErr) => {
      if (updateErr) return res.status(500).json({ message: 'Server error' });
      db.get('SELECT * FROM orders WHERE id = ?', [id], (getErr, updated) => {
        res.json({ message: 'Payment status updated!', order: formatOrder(updated) });
      });
    });
  });
});

module.exports = router;
