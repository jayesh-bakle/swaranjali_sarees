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
  const pid = Number(product_id);
  const ratingNum = Number(rating);

  if (!Number.isInteger(pid) || pid <= 0) {
    return res.status(400).json({ message: 'Valid product id is required' });
  }
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ message: 'Rating must be a whole number between 1 and 5' });
  }
  if (title && String(title).length > 120) {
    return res.status(400).json({ message: 'Title must be 120 characters or fewer' });
  }
  if (comment && String(comment).length > 1000) {
    return res.status(400).json({ message: 'Comment must be 1000 characters or fewer' });
  }

  db.get('SELECT id FROM products WHERE id = ?', [pid], (err, product) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const proceed = () => upsertReview(pid, ratingNum, title || '', comment || '', req.user.id, res);

    // Optional: only verified purchasers may review (off by default so seed data works)
    if (process.env.REQUIRE_PURCHASE_FOR_REVIEWS !== 'true') return proceed();

    db.get(
      `SELECT COUNT(*) as c FROM orders o, json_each(o.items) item
       WHERE o.user_id = ? AND o.status != 'cancelled'
         AND CAST(json_extract(item.value, '$.id') AS INTEGER) = ?`,
      [req.user.id, pid],
      (pErr, row) => {
        if (pErr) return res.status(500).json({ message: 'Server error' });
        if (!row || row.c === 0) {
          return res.status(403).json({ message: 'Only verified purchasers can review this product' });
        }
        proceed();
      }
    );
  });
});

// Insert-or-update a review (one per user per product)
const upsertReview = (productId, rating, title, comment, userId, res) => {
  db.get('SELECT id FROM reviews WHERE product_id = ? AND user_id = ?', [productId, userId], (checkErr, existing) => {
    if (checkErr) return res.status(500).json({ message: 'Server error' });
    if (existing) {
      db.run(
        'UPDATE reviews SET rating = ?, title = ?, comment = ? WHERE id = ?',
        [rating, title, comment, existing.id],
        function (updateErr) {
          if (updateErr) return res.status(500).json({ message: 'Server error' });
          db.get(
            'SELECT r.*, u.name as user_name FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.id = ?',
            [existing.id],
            (getErr, review) => {
              if (getErr) return res.status(500).json({ message: 'Server error' });
              res.json({ message: 'Review updated!', review });
            }
          );
        }
      );
    } else {
      db.run(
        'INSERT INTO reviews (product_id, user_id, rating, title, comment) VALUES (?, ?, ?, ?, ?)',
        [productId, userId, rating, title, comment],
        function (insertErr) {
          if (insertErr) return res.status(500).json({ message: 'Server error' });
          const reviewId = this.lastID;
          db.get(
            'SELECT r.*, u.name as user_name FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.id = ?',
            [reviewId],
            (getErr, review) => {
              if (getErr) return res.status(500).json({ message: 'Server error' });
              res.status(201).json({ message: 'Review added! Thank you!', review });
            }
          );
        }
      );
    }
  });
};

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