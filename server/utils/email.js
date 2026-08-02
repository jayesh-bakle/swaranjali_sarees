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
      from: process.env.MAIL_FROM || `"SareeElegance" <${process.env.MAIL_USER}>`,
      to: customer.email,
      subject: `Order #${order.id} confirmed — SareeElegance`,
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
        '— SareeElegance',
      ].join('\n'),
    });
    console.log(`📧 Order confirmation email sent for order #${order.id}`);
  } catch (err) {
    console.error('Email send failed (non-fatal):', err.message);
  }
};

module.exports = { sendOrderConfirmation };
