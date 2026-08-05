const nodemailer = require('nodemailer');

// SMTP is optional — the app works fully with emails disabled.
const isConfigured = () => !!(process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS);

let transporter = null;
const getTransporter = () => {
  if (!isConfigured()) return null;
  if (!transporter) {
    const port = Number(process.env.MAIL_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
    });
  }
  return transporter;
};

const formatINR = (amount) => `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// Send an order confirmation email. Never throws — failures are logged, not fatal.
const sendOrderConfirmation = async ({ order, items = [], customer = {} }) => {
  const transport = getTransporter();
  if (!transport || !customer?.email) return;

  const lines = items
    .map((it, i) => `${i + 1}. ${it.name} × ${it.quantity} — ${formatINR(it.price * it.quantity)}`)
    .join('\n');

  try {
    await transport.sendMail({
      from: process.env.MAIL_FROM || `"Jagmohini Paithani" <${process.env.MAIL_USER}>`,
      to: customer.email,
      subject: `Order #${order.id} confirmed — Jagmohini Paithani`,
      text: [
        `Hi ${customer.name || 'there'},`,
        '',
        `Thank you for your order! Your order #${order.id} has been placed successfully.`,
        '',
        lines,
        '',
        `Order total: ${formatINR(order.total)}`,
        `Payment method: ${order.payment_method === 'cod' ? 'Cash on Delivery' : 'Online payment'}`,
        '',
        'We will keep you updated as your order ships.',
        '',
        '— Jagmohini Paithani',
      ].join('\n'),
    });
    console.log(`📧 Order confirmation email sent for order #${order.id}`);
  } catch (err) {
    console.error('Email send failed (non-fatal):', err.message);
  }
};

// Send a password-reset email with a single-use reset link. Never throws.
const sendPasswordResetEmail = async ({ email, resetToken }) => {
  const transport = getTransporter();
  if (!transport || !email) return false;

  const baseUrl = (process.env.FRONTEND_URL || 'https://swaranjali-client.onrender.com').replace(/\/$/, '');
  const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

  try {
    await transport.sendMail({
      from: process.env.MAIL_FROM || `"Jagmohini Paithani" <${process.env.MAIL_USER}>`,
      to: email,
      subject: 'Reset your password — Jagmohini Paithani',
      text: [
        'Hi,',
        '',
        'We received a request to reset your password.',
        '',
        `Open this link to choose a new password (valid for 1 hour):`,
        resetLink,
        '',
        'If you did not request this, you can safely ignore this email.',
        '',
        '— Jagmohini Paithani',
      ].join('\n'),
    });
    console.log(`📧 Password reset email sent to ${email}`);
    return true;
  } catch (err) {
    console.error('Password reset email failed (non-fatal):', err.message);
    return false;
  }
};

module.exports = { sendOrderConfirmation, sendPasswordResetEmail };
