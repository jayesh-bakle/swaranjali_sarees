const express = require('express');
const db = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

// Helper: Add tracking timeline entry
const addTracking = (orderId, status, note = '', location = '') => {
  db.run(
    'INSERT INTO order_tracking (order_id, status, note, location) VALUES (?, ?, ?, ?)',
    [orderId, status, note, location],
    (err) => {
      if (err) console.error('Tracking insert error:', err.message);
    }
  );
};

// Helper: Get order with items parsed
const formatOrder = (order) => {
  if (!order) return null;
  return { ...order, items: JSON.parse(order.items) };
};

// POST /api/orders - Create a new order (regular users only)
router.post('/', auth, (req, res) => {
  // Admin cannot place orders — they manage the store
  if (req.user.is_admin) {
    return res.status(403).json({ message: 'Admins manage the store. Only customers can place orders.' });
  }

  const { items, total, shipping_address, phone, payment_method, payment_details } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Order must contain at least one item' });
  }
  if (!total || total <= 0) {
    return res.status(400).json({ message: 'Invalid order total' });
  }
  if (!shipping_address) {
    return res.status(400).json({ message: 'Shipping address is required' });
  }

  const paymentMethod = payment_method || 'cod'; // cod = Cash on Delivery
  const paymentStatus = paymentMethod === 'cod' ? 'pending' : 'paid';
  const orderStatus = paymentMethod === 'cod' ? 'confirmed' : 'confirmed';

  // First check stock availability for all items
  const checkStock = (index) => {
    if (index >= items.length) {
      // All items checked — proceed with order
      db.run(
        `INSERT INTO orders (user_id, items, total, shipping_address, phone, status, payment_status, payment_method)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, JSON.stringify(items), parseFloat(total), shipping_address, phone || '', orderStatus, paymentStatus, paymentMethod],
        function (err) {
          if (err) {
            return res.status(500).json({ message: 'Server error', error: err.message });
          }

          const orderId = this.lastID;
          addTracking(orderId, orderStatus, paymentMethod === 'cod' ? 'Order placed. Pay on delivery.' : 'Order placed and paid.');

          // Record payment if not COD
          if (paymentMethod !== 'cod' && paymentMethod !== 'cash') {
            // Use the real Razorpay payment/order ID when available, otherwise generate a reference
            const rzpPaymentId = payment_details?.razorpay_payment_id;
            const transactionId = rzpPaymentId || 'TXN-' + Date.now() + '-' + Math.round(Math.random() * 1e6);
            db.run(
              'INSERT INTO payments (order_id, user_id, amount, method, status, transaction_id, payment_details) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [orderId, req.user.id, parseFloat(total), paymentMethod, 'completed', transactionId, payment_details ? JSON.stringify(payment_details) : null],
              (payErr) => {
                if (payErr) console.error('Payment insert error:', payErr.message);
              }
            );
          }

          // Decrement stock for each item
          const updateStock = (i) => {
            if (i >= items.length) {
              return db.get('SELECT * FROM orders WHERE id = ?', [orderId], (getErr, order) => {
                if (getErr) return res.status(500).json({ message: 'Server error', error: getErr.message });
                res.status(201).json({
                  message: 'Order placed successfully!',
                  order: formatOrder(order)
                });
              });
            }
            const item = items[i];
            db.run('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?', [item.quantity, item.id, item.quantity], (updateErr) => {
              if (updateErr) return res.status(500).json({ message: 'Server error', error: updateErr.message });
              updateStock(i + 1);
            });
          };
          updateStock(0);
        }
      );
      return;
    }

    const item = items[index];
    db.get('SELECT stock FROM products WHERE id = ?', [item.id], (err, row) => {
      if (err) return res.status(500).json({ message: 'Server error', error: err.message });
      if (!row) {
        return res.status(400).json({ message: `Product not found in stock: ${item.name}` });
      }
      if (row.stock < item.quantity) {
        return res.status(400).json({ message: `Not enough stock for ${item.name}. Only ${row.stock} left.` });
      }
      checkStock(index + 1);
    });
  };

  checkStock(0);
});

// GET /api/orders - Get my orders (regular users)
router.get('/', auth, (req, res) => {
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (!req.user.is_admin) {
    sql += ' AND user_id = ?';
    params.push(req.user.id);
  }

  sql += ' ORDER BY created_at DESC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Server error', error: err.message });
    }
    const orders = rows.map(formatOrder);
    res.json({ orders });
  });
});

// GET /api/orders/all - Get all orders (admin only)
router.get('/all', auth, (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  db.all(
    `SELECT o.*, u.name as customer_name, u.email as customer_email FROM orders o
     JOIN users u ON u.id = o.user_id
     ORDER BY o.created_at DESC`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ message: 'Server error', error: err.message });
      }
      const orders = rows.map(formatOrder);
      res.json({ orders });
    }
  );
});

// GET /api/orders/:id - Get single order with tracking (own order or admin)
router.get('/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid order id' });

  db.get('SELECT * FROM orders WHERE id = ?', [id], (err, order) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Regular users can only access their own orders
    if (!req.user.is_admin && order.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get tracking timeline
    db.all('SELECT * FROM order_tracking WHERE order_id = ? ORDER BY updated_at ASC', [id], (trackErr, tracking) => {
      if (trackErr) return res.status(500).json({ message: 'Server error', error: trackErr.message });

      // Get payment info if available
      db.all('SELECT * FROM payments WHERE order_id = ?', [id], (payErr, payments) => {
        if (payErr) return res.status(500).json({ message: 'Server error', error: payErr.message });

        // Get customer info for admin
        if (req.user.is_admin) {
          db.get('SELECT id, name, email FROM users WHERE id = ?', [order.user_id], (userErr, customer) => {
            if (userErr) return res.status(500).json({ message: 'Server error', error: userErr.message });
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
  if (req.user.is_admin) {
    return res.status(403).json({ message: 'Customers can cancel orders. Admins should update status from admin panel.' });
  }

  db.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [id, req.user.id], (err, existingOrder) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    if (!existingOrder) return res.status(404).json({ message: 'Order not found' });

    const cancellable = ['pending', 'confirmed', 'processing'];
    if (!cancellable.includes(existingOrder.status)) {
      return res.status(400).json({ message: `Order cannot be cancelled in "${existingOrder.status}" status` });
    }

    // Restore stock
    const orderItems = JSON.parse(existingOrder.items);
    const restoreStock = (i) => {
      if (i >= orderItems.length) {
        db.run('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['cancelled', id], (updateErr) => {
          if (updateErr) return res.status(500).json({ message: 'Server error', error: updateErr.message });
          addTracking(id, 'cancelled', 'Order cancelled by customer.');
          db.run('UPDATE orders SET payment_status = ? WHERE id = ? AND payment_status = ?', ['refunded', id, 'paid']);
          db.get('SELECT * FROM orders WHERE id = ?', [id], (getErr, order) => {
            res.json({ message: 'Order cancelled!', order: formatOrder(order) });
          });
        });
        return;
      }
      const item = orderItems[i];
      db.run('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.id], (updateErr) => {
        if (updateErr) return res.status(500).json({ message: 'Server error', error: updateErr.message });
        restoreStock(i + 1);
      });
    };
    restoreStock(0);
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

  // When an order is cancelled, restore the stock
  db.get('SELECT * FROM orders WHERE id = ?', [id], (getOrderErr, existingOrder) => {
    if (getOrderErr) return res.status(500).json({ message: 'Server error', error: getOrderErr.message });
    if (!existingOrder) return res.status(404).json({ message: 'Order not found' });

    const wasCancelled = existingOrder.status === 'cancelled';
    const isNowCancelled = status === 'cancelled';

    db.run('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id], (err) => {
      if (err) return res.status(500).json({ message: 'Server error', error: err.message });

      // Add tracking entry
      let statusNote = note || '';
      if (status === 'shipped' && !statusNote) statusNote = 'Order shipped from warehouse.';
      if (status === 'out_for_delivery' && !statusNote) statusNote = 'Out for delivery.';
      if (status === 'delivered' && !statusNote) statusNote = 'Delivered successfully.';
      addTracking(id, status, statusNote, location || '');

      // Restore stock when order is cancelled (if it wasn't already cancelled)
      if (isNowCancelled && !wasCancelled) {
        const orderItems = JSON.parse(existingOrder.items);
        const restoreStock = (i) => {
          if (i >= orderItems.length) {
            return db.get('SELECT * FROM orders WHERE id = ?', [id], (getErr, order) => {
              if (getErr) return res.status(500).json({ message: 'Server error', error: getErr.message });
              res.json({ message: 'Order updated successfully!', order: formatOrder(order) });
            });
          }
          const item = orderItems[i];
          db.run('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.id], (updateErr) => {
            if (updateErr) return res.status(500).json({ message: 'Server error', error: updateErr.message });
            restoreStock(i + 1);
          });
        };
        restoreStock(0);
      } else {
        db.get('SELECT * FROM orders WHERE id = ?', [id], (getErr, order) => {
          if (getErr) return res.status(500).json({ message: 'Server error', error: getErr.message });
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
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    db.run('UPDATE orders SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [payment_status, id], (updateErr) => {
      if (updateErr) return res.status(500).json({ message: 'Server error', error: updateErr.message });
      db.get('SELECT * FROM orders WHERE id = ?', [id], (getErr, updated) => {
        res.json({ message: 'Payment status updated!', order: formatOrder(updated) });
      });
    });
  });
});

module.exports = router;