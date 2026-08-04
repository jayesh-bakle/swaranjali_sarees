const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const db = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Review photos — same Cloudinary/local-disk pattern as product uploads.
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUD_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUD_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const useCloudinary = !!(CLOUD_NAME && CLOUD_API_KEY && CLOUD_API_SECRET);

if (useCloudinary) {
  cloudinary.config({ cloud_name: CLOUD_NAME, api_key: CLOUD_API_KEY, api_secret: CLOUD_API_SECRET });
}

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const MIME_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const IMAGE_MIME = new Set(Object.keys(MIME_EXT));

const storage = useCloudinary
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadsDir),
      filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `review-${unique}${MIME_EXT[file.mimetype] || '.jpg'}`);
      },
    });

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per photo
  fileFilter: (req, file, cb) => {
    if (IMAGE_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files (JPEG, PNG, WEBP, GIF) are allowed'));
  },
});

// Upload a review photo → CDN URL (or local path in dev)
const uploadPhoto = async (file) => {
  if (useCloudinary) {
    const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const result = await cloudinary.uploader.upload(base64, {
      folder: 'review_photos',
      resource_type: 'image',
    });
    return result.secure_url;
  }
  return `/uploads/${file.filename}`;
};

// Sync denormalized avg_rating / review_count on the products table after any
// review write.  Keeps the catalog list from needing per-row subqueries.
const syncProductRatings = (productId) => {
  db.run(
    `UPDATE products SET
       avg_rating = (SELECT AVG(rating) FROM reviews WHERE product_id = ?),
       review_count = (SELECT COUNT(*) FROM reviews WHERE product_id = ?)
     WHERE id = ?`,
    [productId, productId, productId],
    (err) => { if (err) console.error('Rating sync error:', err.message); }
  );
};

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
      if (err) return res.status(500).json({ message: 'Server error' });
      res.json({ reviews: rows });
    }
  );
});

// GET /api/reviews/product/:productId/summary - Rating summary (uses denormalized columns)
router.get('/product/:productId/summary', (req, res) => {
  const productId = Number(req.params.productId);
  db.get(
    'SELECT review_count as count, avg_rating FROM products WHERE id = ?',
    [productId],
    (err, row) => {
      if (err) return res.status(500).json({ message: 'Server error' });
      res.json({
        count: row?.count || 0,
        avg_rating: row?.avg_rating ? Number(row.avg_rating).toFixed(1) : null
      });
    }
  );
});

// POST /api/reviews - Add a review (regular users, one per product)
router.post('/', auth, upload.array('photos', 3), async (req, res) => {
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

  // Upload any attached photos to Cloudinary/local disk
  let photos = [];
  if (req.files && req.files.length > 0) {
    try {
      photos = await Promise.all(req.files.map(uploadPhoto));
    } catch (err) {
      return res.status(500).json({ message: 'Failed to upload review photos' });
    }
  }

  db.get('SELECT id FROM products WHERE id = ?', [pid], (err, product) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const proceed = () => upsertReview(pid, ratingNum, title || '', comment || '', photos, req.user.id, res);

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

// Insert-or-update a review (one per user per product). photos is an array of URLs.
const upsertReview = (productId, rating, title, comment, photos, userId, res) => {
  const photosJson = JSON.stringify(photos || []);
  db.get('SELECT id FROM reviews WHERE product_id = ? AND user_id = ?', [productId, userId], (checkErr, existing) => {
    if (checkErr) return res.status(500).json({ message: 'Server error' });
    if (existing) {
      db.run(
        'UPDATE reviews SET rating = ?, title = ?, comment = ?, photos = ? WHERE id = ?',
        [rating, title, comment, photosJson, existing.id],
        function (updateErr) {
          if (updateErr) return res.status(500).json({ message: 'Server error' });
          db.get(
            'SELECT r.*, u.name as user_name FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.id = ?',
            [existing.id],
            (getErr, review) => {
              if (getErr) return res.status(500).json({ message: 'Server error' });
              syncProductRatings(productId);
              res.json({ message: 'Review updated!', review });
            }
          );
        }
      );
    } else {
      db.run(
        'INSERT INTO reviews (product_id, user_id, rating, title, comment, photos) VALUES (?, ?, ?, ?, ?, ?)',
        [productId, userId, rating, title, comment, photosJson],
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
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!review) return res.status(404).json({ message: 'Review not found' });
    if (review.user_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ message: 'You can only delete your own reviews' });
    }
    db.run('DELETE FROM reviews WHERE id = ?', [id], (deleteErr) => {
      if (deleteErr) return res.status(500).json({ message: 'Server error' });
      syncProductRatings(review.product_id);
      res.json({ message: 'Review deleted' });
    });
  });
});

module.exports = router;