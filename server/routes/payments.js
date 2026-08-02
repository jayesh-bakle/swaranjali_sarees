const express = require('express');
const db = require('../db');
const { auth } = require('../middleware/auth');
const { getRazorpay, isConfigured, verifyPaymentSignature, verifyWebhookSignature } = require('../utils/razorpay');

const router = express.Router();

// Shared helper: mark an order + its payment as paid and log a tracking entry.
// Returns a Promise that resolves after the DB writes complete, so callers can
// respond only once the order actually shows as paid (avoids a stale "pending").
const markPaid = (orderId, total, userId, paymentId, details) =>
  new Promise((resolve) => {
    db.run(
      `UPDATE orders SET payment_status = 'paid', payment_method = 'razorpay',
         status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [orderId],
      (err) => {
        if (err) console.error('Mark-paid order update error:', err.message);
        db.run(
          `UPDATE payments SET status = 'completed', transaction_id = ?, payment_details = ? WHERE order_id = ?`,
          [paymentId, JSON.stringify(details), orderId],
          (uErr) => {
            if (uErr) console.error('Payment update error:', uErr.message);
            db.run(
              `INSERT INTO order_tracking (order_id, status, note) VALUES (?, 'confirmed', 'Payment received. Order confirmed.')`,
              [orderId],
              (tErr) => {
                if (tErr) console.error('Tracking insert error:', tErr.message);
                resolve();
              }
            );
          }
        );
      }
    );
  });

// POST /api/payments/create-order - Create a Razorpay order (kept for compatibility).
// NOTE: verification now requires a matching pending payment created via
// /create-order-for-order/:orderId, so an arbitrary amount here cannot be used
// to "pay" for a real order.
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
    rzp.orders.create({
      amount: Math.round(amount * 100), // Razorpay uses paise (₹1 = 100 paise)
      currency: currency || 'INR',
      receipt: receipt || 'rcpt_' + Date.now(),
      notes: notes || { userId: String(req.user.id) },
    })
      .then((order) => {
        res.json({ order_id: order.id, amount: order.amount, currency: order.currency, key_id: process.env.RAZORPAY_KEY_ID });
      })
      .catch((err) => {
        console.error('Razorpay create order error:', err);
        res.status(500).json({ message: 'Failed to create payment order' });
      });
  } catch (err) {
    console.error('Razorpay init error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/payments/create-order-for-order/:orderId - Create a Razorpay order for an existing unpaid order.
// Persists a pending payment record so /verify and the webhook can cross-check amount + ownership.
router.post('/create-order-for-order/:orderId', auth, (req, res) => {
  if (req.user.is_admin) {
    return res.status(403).json({ message: 'Admins manage the store. Only customers can checkout.' });
  }

  const orderId = Number(req.params.orderId);
  if (!orderId) return res.status(400).json({ message: 'Invalid order id' });

  db.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, req.user.id], (err, order) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.payment_status === 'paid') {
      return res.status(400).json({ message: 'Order is already paid' });
    }
    if (order.status === 'cancelled') {
      return res.status(400).json({ message: 'Cannot pay for a cancelled order' });
    }

    try {
      const rzp = getRazorpay();
      rzp.orders.create({
        amount: Math.round(order.total * 100), // amount locked to the server-side order total
        currency: 'INR',
        receipt: 'rcpt_order_' + order.id,
        notes: { userId: String(req.user.id), orderId: String(order.id) },
      })
        .then((rzpOrder) => {
          // Persist a pending payment tied to this razorpay order id.
          // Respond ONLY after the insert completes — otherwise a fast /verify
          // (right after checkout) races ahead of the INSERT and finds no payment row.
          db.run('DELETE FROM payments WHERE order_id = ? AND status = ?', [orderId, 'pending'], () => {
            db.run(
              `INSERT INTO payments (order_id, user_id, amount, method, status, transaction_id, payment_details)
               VALUES (?, ?, ?, 'razorpay', 'pending', ?, ?)`,
              [orderId, req.user.id, order.total, rzpOrder.id,
               JSON.stringify({ razorpay_order_id: rzpOrder.id, expected_amount_paise: Math.round(order.total * 100) })],
              (insErr) => {
                if (insErr) console.error('Pending payment insert error:', insErr.message);
                res.json({
                  order_id: rzpOrder.id,
                  amount: rzpOrder.amount,
                  currency: rzpOrder.currency,
                  key_id: process.env.RAZORPAY_KEY_ID,
                });
              }
            );
          });
        })
        .catch((createErr) => {
          console.error('Razorpay create order error:', createErr);
          res.status(500).json({ message: 'Failed to create payment order' });
        });
    } catch (initErr) {
      console.error('Razorpay init error:', initErr.message);
      res.status(500).json({ message: initErr.message });
    }
  });
});

// POST /api/payments/verify - Verify payment signature after the checkout dialog closes.
// Marks the referenced order paid ONLY when the captured amount matches the order total.
router.post('/verify', auth, (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ message: 'Missing payment verification data' });
  }
  const oid = Number(orderId);
  if (!oid) {
    return res.status(400).json({ message: 'orderId is required to verify an order payment' });
  }

  if (!verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
    return res.status(400).json({ success: false, verified: false, message: 'Payment signature verification failed' });
  }

  db.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [oid, req.user.id], (err, order) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.payment_status === 'paid') {
      return res.json({ success: true, verified: true, already_paid: true });
    }
    if (order.status === 'cancelled') {
      return res.status(400).json({ message: 'Cannot pay for a cancelled order' });
    }

    // The razorpay order id must correspond to a payment we initiated for THIS order
    db.get(
      'SELECT * FROM payments WHERE order_id = ? AND transaction_id = ?',
      [oid, razorpay_order_id],
      (pErr, pendingPayment) => {
        if (pErr) return res.status(500).json({ message: 'Server error' });
        if (!pendingPayment) {
          return res.status(400).json({ success: false, verified: false, message: 'No payment was initiated for this order' });
        }

        const confirmPayment = (actualPaise) => {
          const expectedPaise = Math.round(order.total * 100);
          if (Math.abs(Number(actualPaise) - expectedPaise) > 1) {
            return res.status(400).json({ success: false, verified: false, message: 'Paid amount does not match order total' });
          }
          markPaid(oid, order.total, req.user.id, razorpay_payment_id, {
            razorpay_order_id, razorpay_payment_id, razorpay_signature,
          }).then(() => res.json({ success: true, verified: true }));
        };

        if (isConfigured()) {
          // Authoritative check: the actually-captured Razorpay amount
          getRazorpay()
            .payments.fetch(razorpay_payment_id)
            .then((p) => confirmPayment(p.amount))
            .catch(() => confirmPayment(pendingPayment.amount * 100)); // fall back to recorded amount
        } else {
          confirmPayment(pendingPayment.amount * 100);
        }
      }
    );
  });
});

// POST /api/payments/webhook - Razorpay webhook for server-side confirmation (no auth — Razorpay calls this).
// Signature is verified over the RAW request body (Razorpay signs the raw bytes).
router.post('/webhook', (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);

  if (!verifyWebhookSignature(rawBody, signature)) {
    return res.status(400).json({ message: 'Invalid signature' });
  }

  const event = req.body.event;
  const payment = req.body.payload?.payment?.entity;

  if (event === 'payment.captured' && payment) {
    const orderId = Number(payment.notes?.orderId || payment.notes?.order_id || 0);
    if (!orderId) {
      return res.json({ received: true });
    }
    db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, order) => {
      if (err) return res.status(500).json({ message: 'Server error' });
      if (!order) return res.status(404).json({ message: 'Order not found' });

      // Cross-check the captured amount against the order total (Razorpay uses paise)
      const paidPaise = Number(payment.amount);
      const expectedPaise = Math.round(order.total * 100);
      if (Math.abs(paidPaise - expectedPaise) > 1) {
        return res.status(400).json({ message: 'Paid amount does not match order total' });
      }

      markPaid(orderId, order.total, order.user_id, payment.id, {
        razorpay_payment_id: payment.id,
        razorpay_order_id: payment.order_id,
      }).then(() => res.json({ received: true }));
    });
  } else {
    res.json({ received: true });
  }
});

module.exports = router;
