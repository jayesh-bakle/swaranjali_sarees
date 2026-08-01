const express = require('express');
const db = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/reviews/product/:productId - Get reviews for a product
router.get('/product/:productId', (req, res) => {
  const productId = Number(req.params.productId);
  if (!productId) return res.status(400).json({ message: 'Invalid product id' });

  db.all(
    `SELECT r.*, u.name as user_name FROM reviews r
     JOIN users u ON u.id = r.user_id
     WHERE r.product_id = ? ORDER BY r.created_at DESC`,
    [productId],
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Server error', error: err.message });
      res.json({ reviews: rows });
    }
  );
});

// GET /api/reviews/product/:productId/summary - Rating summary for a product
router.get('/product/:productId/summary', (req, res) => {
  const productId = Number(req.params.productId);
  db.get(
    'SELECT COUNT(*) as count, AVG(rating) as avg_rating FROM reviews WHERE product_id = ?',
    [productId],
    (err, row) => {
      if (err) return res.status(500).json({ message: 'Server error', error: err.message });
      res.json({
        count: row?.count || 0,
        avg_rating: row?.avg_rating ? Number(row.avg_rating).toFixed(1) : null
      });
    }
  );
});

// POST /api/reviews - Add a review (regular users, one per product)
router.post('/', auth, (req, res) => {
  if (req.user.is_admin) {
    return res.status(403).json({ message: 'Only customers can review products' });
  }

  const { product_id, rating, title, comment } = req.body;
  if (!product_id || !rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Product id and rating (1-5) are required' });
  }

  db.get('SELECT id FROM products WHERE id = ?', [product_id], (err, product) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    db.get('SELECT id FROM reviews WHERE product_id = ? AND user_id = ?', [product_id, req.user.id], (checkErr, existing) => {
      if (checkErr) return res.status(500).json({ message: 'Server error', error: checkErr.message });
      if (existing) {
        // Update existing review
        db.run(
          'UPDATE reviews SET rating = ?, title = ?, comment = ? WHERE id = ?',
          [Number(rating), title || '', comment || '', existing.id],
          function (updateErr) {
            if (updateErr) return res.status(500).json({ message: 'Server error', error: updateErr.message });
            db.get(
              'SELECT r.*, u.name as user_name FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.id = ?',
              [existing.id],
              (getErr, review) => {
                if (getErr) return res.status(500).json({ message: 'Server error', error: getErr.message });
                res.json({ message: 'Review updated!', review });
              }
            );
          }
        );
      } else {
        // Insert new review
        db.run(
          'INSERT INTO reviews (product_id, user_id, rating, title, comment) VALUES (?, ?, ?, ?, ?)',
          [product_id, req.user.id, Number(rating), title || '', comment || ''],
          function (insertErr) {
            if (insertErr) return res.status(500).json({ message: 'Server error', error: insertErr.message });
            const reviewId = this.lastID;
            db.get(
              'SELECT r.*, u.name as user_name FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.id = ?',
              [reviewId],
              (getErr, review) => {
                if (getErr) return res.status(500).json({ message: 'Server error', error: getErr.message });
                res.status(201).json({ message: 'Review added! Thank you!', review });
              }
            );
          }
        );
      }
    });
  });
});

// DELETE /api/reviews/:id - Delete own review
router.delete('/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  db.get('SELECT * FROM reviews WHERE id = ?', [id], (err, review) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    if (!review) return res.status(404).json({ message: 'Review not found' });
    if (review.user_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ message: 'You can only delete your own reviews' });
    }
    db.run('DELETE FROM reviews WHERE id = ?', [id], (deleteErr) => {
      if (deleteErr) return res.status(500).json({ message: 'Server error', error: deleteErr.message });
      res.json({ message: 'Review deleted' });
    });
  });
});

module.exports = router;