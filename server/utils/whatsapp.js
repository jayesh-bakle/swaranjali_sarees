/**
 * WhatsApp order notifications to the store owner.
 *
 * Uses the wa.me deep link approach — opens WhatsApp with a pre-filled message.
 * For production automation (unattended alerts), a proper WhatsApp Business API
 * (e.g. Twilio, Meta Cloud API) would replace this. This is a zero-cost
 * best-effort notification that the store owner can click.
 */

const STORE_PHONE = process.env.WHATSAPP_STORE_PHONE || '917264948777';

// Build a wa.me link with the order summary pre-filled
function buildWhatsAppLink(order, orderItems, customer = {}) {
  const lines = [
    '🛍️ *NEW ORDER*',
    `Order #${order.id}`,
    `Total: ₹${Number(order.total).toLocaleString('en-IN')}`,
    `Payment: ${(order.payment_method || 'cod').toUpperCase()}`,
    `Customer: ${customer.name || ''} ${customer.phone ? `(${customer.phone})` : ''}`,
  ];
  if (orderItems && orderItems.length) {
    lines.push('Items:');
    orderItems.forEach((item) => {
      lines.push(`  • ${item.name} × ${item.quantity}`);
    });
  }
  lines.push(`Address: ${(order.shipping_address || '').slice(0, 60)}`);
  const text = encodeURIComponent(lines.join('\n'));
  return `https://wa.me/${STORE_PHONE}?text=${text}`;
}

// Fire-and-forget: log the wa.me link (the store owner sees it in the order
// confirmation email / can be wired to a click-to-WhatsApp button in admin).
function sendOrderWhatsApp(order, orderItems, customer = {}) {
  try {
    const link = buildWhatsAppLink(order, orderItems, customer);
    console.log(`📲 WhatsApp order notification: ${link}`);
    return link;
  } catch (err) {
    console.error('WhatsApp notification error:', err.message);
    return null;
  }
}

module.exports = { buildWhatsAppLink, sendOrderWhatsApp };
