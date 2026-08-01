const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Initialize Razorpay instance (lazy — only when keys are set so app runs without keys)
const getRazorpay = () => {
  const Razorpay = require('razorpay');
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    const err = new Error('Razorpay keys not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
    err.status = 500;
    throw err;
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

// POST /api/payments/create-order - Create a Razorpay order (authenticated customers)
router.post('/create-order', auth, (req, res) => {
  if (req.user.is_admin) {
    return res.status(403).json({ message: 'Admins manage the store. Only customers can checkout.' });
  }

  const { amount, currency, receipt, notes } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'Invalid amount' });
  }

  try {
    const rzp = getRazorpay();
    const options = {
      amount: Math.round(amount * 100), // Razorpay uses paise (₹1 = 100 paise)
      currency: currency || 'INR',
      receipt: receipt || 'rcpt_' + Date.now(),
      notes: notes || { userId: String(req.user.id) },
    };

    rzp.orders.create(options)
      .then((order) => {
        res.json({
          order_id: order.id,
          amount: order.amount,
          currency: order.currency,
          key_id: process.env.RAZORPAY_KEY_ID,
        });
      })
      .catch((err) => {
        console.error('Razorpay create order error:', err);
        res.status(500).json({ message: 'Failed to create payment order', error: err.message });
      });
  } catch (err) {
    console.error('Razorpay init error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/payments/create-order-for-order/:orderId - Create a Razorpay order for an existing unpaid order
// This lets customers "Pay Now" for orders that were placed with COD or failed payment
router.post('/create-order-for-order/:orderId', auth, (req, res) => {
  if (req.user.is_admin) {
    return res.status(403).json({ message: 'Admins manage the store. Only customers can checkout.' });
  }

  const orderId = Number(req.params.orderId);
  if (!orderId) return res.status(400).json({ message: 'Invalid order id' });

  db.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, req.user.id], (err, order) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.payment_status === 'paid') {
      return res.status(400).json({ message: 'Order is already paid' });
    }
    if (order.status === 'cancelled') {
      return res.status(400).json({ message: 'Cannot pay for a cancelled order' });
    }

    try {
      const rzp = getRazorpay();
      const options = {
        amount: Math.round(order.total * 100), // Razorpay uses paise (₹1 = 100 paise)
        currency: 'INR',
        receipt: 'rcpt_order_' + order.id,
        notes: { userId: String(req.user.id), orderId: String(order.id) },
      };

      rzp.orders.create(options)
        .then((rzpOrder) => {
          res.json({
            order_id: rzpOrder.id,
            amount: rzpOrder.amount,
            currency: rzpOrder.currency,
            key_id: process.env.RAZORPAY_KEY_ID,
          });
        })
        .catch((createErr) => {
          console.error('Razorpay create order error:', createErr);
          res.status(500).json({ message: 'Failed to create payment order', error: createErr.message });
        });
    } catch (initErr) {
      console.error('Razorpay init error:', initErr.message);
      res.status(500).json({ message: initErr.message });
    }
  });
});

// POST /api/payments/verify - Verify payment signature after the checkout dialog closes
// Optionally accepts orderId to automatically mark that order as paid
router.post('/verify', auth, (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ message: 'Missing payment verification data' });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return res.status(500).json({ message: 'Razorpay keys not configured' });
  }

  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(body.toString())
    .digest('hex');

  if (expectedSignature === razorpay_signature) {
    // If orderId is provided, mark that order as paid and record the payment
    if (orderId) {
      const oid = Number(orderId);
      db.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [oid, req.user.id], (err, order) => {
        if (!err && order) {
          db.run(
            `UPDATE orders SET payment_status = 'paid', payment_method = 'razorpay', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [oid],
            (updateErr) => {
              if (updateErr) console.error('Pay-now order update error:', updateErr.message);
            }
          );
          db.run(
            `INSERT INTO payments (order_id, user_id, amount, method, status, transaction_id, payment_details)
             VALUES (?, ?, ?, 'razorpay', 'completed', ?, ?)`,
            [oid, req.user.id, order.total, razorpay_payment_id,
             JSON.stringify({ razorpay_order_id, razorpay_payment_id, razorpay_signature })],
            (payErr) => {
              if (payErr) console.error('Pay-now payment insert error:', payErr.message);
            }
          );
          db.run(
            `INSERT INTO order_tracking (order_id, status, note) VALUES (?, 'confirmed', 'Payment received. Order confirmed.')`,
            [oid],
            (trackErr) => {
              if (trackErr) console.error('Pay-now tracking insert error:', trackErr.message);
            }
          );
        }
      });
    }
    res.json({ success: true, verified: true });
  } else {
    res.status(400).json({ success: false, verified: false, message: 'Payment signature verification failed' });
  }
});

// POST /api/payments/webhook - Razorpay webhook for server-side confirmation (no auth — Razorpay calls this)
router.post('/webhook', (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  // Skip processing if webhook secret not configured (order already verified client-side)
  if (!webhookSecret) {
    return res.json({ received: true });
  }

  const signature = req.headers['x-razorpay-signature'];
  if (!signature) {
    return res.status(400).json({ message: 'Missing signature' });
  }

  // Verify webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (expectedSignature !== signature) {
    return res.status(400).json({ message: 'Invalid signature' });
  }

  // Process the event
  const event = req.body.event;
  const payment = req.body.payload?.payment?.entity;

  if (event === 'payment.captured' && payment) {
    const orderNote = payment.notes || {};
    const orderId = orderNote.orderId || orderNote.order_id;

    if (orderId) {
      db.run(
        `UPDATE orders SET payment_status = 'paid', payment_method = 'razorpay', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [orderId],
        (err) => {
          if (err) console.error('Webhook order update error:', err.message);
        }
      );

      db.run(
        `INSERT INTO payments (order_id, user_id, amount, method, status, transaction_id, payment_details)
         VALUES (?, ?, ?, 'razorpay', 'completed', ?, ?)`,
        [orderId, payment.notes?.userId || 0, (payment.amount || 0) / 100, payment.id, JSON.stringify({ razorpay_payment_id: payment.id, razorpay_order_id: payment.order_id })],
        (payErr) => {
          if (payErr) console.error('Webhook payment insert error:', payErr.message);
        }
      );
    }
  }

  res.json({ received: true });
});

module.exports = router;