const express = require('express');
const db = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/wishlist - Get my wishlist
router.get('/', auth, (req, res) => {
  db.all(
    `SELECT wl.id as wishlist_id, p.* FROM wishlist wl
     JOIN products p ON p.id = wl.product_id
     WHERE wl.user_id = ? ORDER BY wl.created_at DESC`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Server error' });
      res.json({ items: rows });
    }
  );
});

// POST /api/wishlist/:productId - Add to wishlist
router.post('/:productId', auth, (req, res) => {
  const productId = Number(req.params.productId);
  if (!productId) return res.status(400).json({ message: 'Invalid product id' });

  // The product must exist — otherwise (FKs now enforced) we'd get a 500, or an orphan row
  db.get('SELECT id FROM products WHERE id = ?', [productId], (pErr, product) => {
    if (pErr) return res.status(500).json({ message: 'Server error' });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    db.run(
      'INSERT OR IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)',
      [req.user.id, productId],
      function (err) {
        if (err) return res.status(500).json({ message: 'Server error' });
        const added = this.changes > 0;
        res.status(added ? 201 : 200).json({
          message: added ? 'Added to wishlist!' : 'Already in wishlist',
          inWishlist: true
        });
      }
    );
  });
});

// DELETE /api/wishlist/:productId - Remove from wishlist
router.delete('/:productId', auth, (req, res) => {
  const productId = Number(req.params.productId);
  if (!productId) return res.status(400).json({ message: 'Invalid product id' });

  db.run('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?', [req.user.id, productId], function (err) {
    if (err) return res.status(500).json({ message: 'Server error' });
    res.json({ message: 'Removed from wishlist', inWishlist: false });
  });
});

// GET /api/wishlist/check/:productId - Check if in wishlist
router.get('/check/:productId', auth, (req, res) => {
  const productId = Number(req.params.productId);
  db.get('SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?', [req.user.id, productId], (err, row) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    res.json({ inWishlist: !!row });
  });
});

module.exports = router;