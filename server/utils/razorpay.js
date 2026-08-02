/**
 * Shared Razorpay helpers.
 *
 * Everything degrades gracefully when Razorpay keys are missing — the app still
 * runs (COD + local testing), and only payment operations fail with a clear error.
 */

const crypto = require('crypto');

const isConfigured = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

const getRazorpay = () => {
  const Razorpay = require('razorpay');
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    const err = new Error(
      'Razorpay keys not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env for local runs, ' +
      'or in the service environment variables on your hosting platform (e.g. Render Dashboard → Environment).'
    );
    err.status = 500;
    throw err;
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

// Verify the signature returned by Razorpay after the client-side checkout
const verifyPaymentSignature = ({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !process.env.RAZORPAY_KEY_SECRET) {
    return false;
  }
  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(razorpay_signature, 'hex'));
  } catch (_) {
    return false;
  }
};

// Verify a webhook event signature over the RAW request body (Razorpay signs raw bytes)
const verifyWebhookSignature = (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !rawBody || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch (_) {
    return false;
  }
};

/**
 * Issue a refund for a paid order. Best-effort: if Razorpay isn't configured or
 * no Razorpay payment id was recorded, it logs and returns { skipped: true } so
 * order cancellation still completes.
 */
const issueRefund = async (orderId, amount, userId) => {
  const db = require('../db');
  if (!isConfigured()) {
    console.warn(`[razorpay] Refund for order ${orderId} skipped — Razorpay keys not configured.`);
    return { skipped: true };
  }

  const payment = await new Promise((resolve) => {
    db.get(
      'SELECT * FROM payments WHERE order_id = ? AND transaction_id IS NOT NULL ORDER BY id DESC LIMIT 1',
      [orderId],
      (err, row) => resolve(err ? null : row)
    );
  });

  const tx = payment?.transaction_id;
  const paymentId = tx && !String(tx).startsWith('TXN-') ? tx : null; // skip self-generated ids
  if (!paymentId) {
    console.warn(`[razorpay] Refund for order ${orderId} skipped — no Razorpay payment id recorded.`);
    return { skipped: true };
  }

  try {
    const rzp = getRazorpay();
    const refund = await rzp.payments.refund(paymentId);
    db.run(
      'UPDATE payments SET status = ?, payment_details = ? WHERE order_id = ?',
      ['refunded', JSON.stringify({ refund_id: refund.id, refund_status: refund.status }), orderId],
      () => {}
    );
    console.log(`[razorpay] Refund issued for order ${orderId}: ${refund.id} (${refund.status})`);
    return refund;
  } catch (err) {
    console.error(`[razorpay] Refund failed for order ${orderId}:`, err.message);
    return { error: err.message };
  }
};

module.exports = { getRazorpay, isConfigured, verifyPaymentSignature, verifyWebhookSignature, issueRefund };
