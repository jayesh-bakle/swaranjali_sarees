const express = require('express');
const router = express.Router();

// Shipping cost rules for Indian pin codes (first 2 digits → zone).
// These are illustrative defaults; a real store would integrate a courier API.
const ZONE_RULES = {
  // Maharashtra (same-state, cheapest)
  '40': { zone: 'local', days: '2-3', cost: 0 },
  '41': { zone: 'local', days: '2-3', cost: 0 },
  '42': { zone: 'local', days: '2-3', cost: 0 },
  '43': { zone: 'local', days: '2-3', cost: 0 },
  '44': { zone: 'local', days: '2-3', cost: 0 },
  // Metro zones (Delhi NCR, Bengaluru, Mumbai suburbs)
  '11': { zone: 'metro', days: '3-4', cost: 49 },
  '56': { zone: 'metro', days: '3-4', cost: 49 },
  // Tier-1 cities (Kolkata, Chennai, Hyderabad, Pune, Ahmedabad)
  '70': { zone: 'metro', days: '3-4', cost: 49 },
  '60': { zone: 'metro', days: '3-4', cost: 49 },
  '50': { zone: 'metro', days: '3-4', cost: 49 },
  '38': { zone: 'metro', days: '3-4', cost: 49 },
  // Default: rest of India
  default: { zone: 'standard', days: '5-7', cost: 99 }
};

// GET /api/shipping/estimate?pincode=411001&items=2 - Calculate shipping estimate
router.get('/estimate', (req, res) => {
  const { pincode, items } = req.query;
  const numItems = Math.max(1, Number(items) || 1);

  if (!pincode || !/^\d{6}$/.test(String(pincode))) {
    return res.status(400).json({ message: 'Valid 6-digit Indian pincode required' });
  }

  const prefix = String(pincode).slice(0, 2);
  const rule = ZONE_RULES[prefix] || ZONE_RULES.default;

  // Extra items beyond the first add a small per-item fee for heavier shipments
  const perItemFee = rule.zone === 'local' ? 0 : 15;
  const shippingCost = rule.cost + (numItems - 1) * perItemFee;

  res.json({
    pincode: Number(pincode),
    zone: rule.zone,
    estimated_days: rule.days,
    shipping_cost: shippingCost,
    free_shipping: shippingCost === 0
  });
});

module.exports = router;
