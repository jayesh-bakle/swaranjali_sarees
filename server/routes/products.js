const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { auth, admin } = require('../middleware/auth');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `product-${unique}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WEBP, GIF) are allowed'));
    }
  }
});

// ---------- PUBLIC ROUTES ----------

// GET /api/products - List products with optional filters, search, sort, pagination
router.get('/', (req, res) => {
  const { category, fabric, color, search, sort, min_price, max_price, in_stock, page = 1, limit = 50 } = req.query;

  let sql = `SELECT p.*, 
    (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) as review_count,
    (SELECT AVG(rating) FROM reviews r WHERE r.product_id = p.id) as avg_rating
    FROM products p WHERE 1=1`;
  const params = [];

  if (category) {
    sql += ' AND p.category LIKE ?';
    params.push(`%${category}%`);
  }
  if (fabric) {
    sql += ' AND p.fabric LIKE ?';
    params.push(`%${fabric}%`);
  }
  if (color) {
    sql += ' AND p.color LIKE ?';
    params.push(`%${color}%`);
  }
  if (search) {
    sql += ' AND (p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (min_price) {
    sql += ' AND p.price >= ?';
    params.push(parseFloat(min_price));
  }
  if (max_price) {
    sql += ' AND p.price <= ?';
    params.push(parseFloat(max_price));
  }
  if (in_stock === 'true' || in_stock === '1') {
    sql += ' AND p.stock > 0';
  }

  if (sort === 'price_asc') sql += ' ORDER BY p.price ASC';
  else if (sort === 'price_desc') sql += ' ORDER BY p.price DESC';
  else if (sort === 'newest') sql += ' ORDER BY p.created_at DESC';
  else if (sort === 'rating') sql += ' ORDER BY avg_rating DESC';
  else if (sort === 'featured') sql += ' AND p.is_featured = 1 ORDER BY p.created_at DESC';
  else sql += ' ORDER BY p.created_at DESC';

  sql += ' LIMIT ? OFFSET ?';
  const limitNum = Math.min(Number(limit) || 50, 100);
  const pageNum = Math.max(Number(page) || 1, 1);
  params.push(limitNum, (pageNum - 1) * limitNum);

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Server error', error: err.message });
    }

    // Format avg_rating
    const products = rows.map((p) => ({
      ...p,
      avg_rating: p.avg_rating ? Number(p.avg_rating).toFixed(1) : null,
      review_count: p.review_count || 0
    }));

    res.json({ products, page: pageNum, limit: limitNum });
  });
});

// GET /api/products/featured - Get featured products
router.get('/featured', (req, res) => {
  db.all(
    `SELECT p.*, 
      (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) as review_count,
      (SELECT AVG(rating) FROM reviews r WHERE r.product_id = p.id) as avg_rating
     FROM products p WHERE p.is_featured = 1 AND p.stock > 0 ORDER BY p.created_at DESC LIMIT 8`,
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Server error', error: err.message });
      const products = rows.map((p) => ({ ...p, avg_rating: p.avg_rating ? Number(p.avg_rating).toFixed(1) : null, review_count: p.review_count || 0 }));
      res.json({ products });
    }
  );
});

// GET /api/products/related/:id - Related products by category
router.get('/related/:id', (req, res) => {
  const id = Number(req.params.id);
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    db.all(
      `SELECT p.*, 
        (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) as review_count,
        (SELECT AVG(rating) FROM reviews r WHERE r.product_id = p.id) as avg_rating
       FROM products p WHERE p.category = ? AND p.id != ? AND p.stock > 0 LIMIT 4`,
      [product.category, id],
      (relatedErr, rows) => {
        if (relatedErr) return res.status(500).json({ message: 'Server error', error: relatedErr.message });
        const products = rows.map((p) => ({ ...p, avg_rating: p.avg_rating ? Number(p.avg_rating).toFixed(1) : null, review_count: p.review_count || 0 }));
        res.json({ products });
      }
    );
  });
});

// GET /api/products/:id - Get a single product with rating info
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!id) {
    return res.status(400).json({ message: 'Invalid product id' });
  }

  db.get(
    `SELECT p.*, 
      (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) as review_count,
      (SELECT AVG(rating) FROM reviews r WHERE r.product_id = p.id) as avg_rating
     FROM products p WHERE p.id = ?`,
    [id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ message: 'Server error', error: err.message });
      }
      if (!row) {
        return res.status(404).json({ message: 'Product not found' });
      }
      res.json({ product: { ...row, avg_rating: row.avg_rating ? Number(row.avg_rating).toFixed(1) : null, review_count: row.review_count || 0 } });
    }
  );
});

// ---------- ADMIN ROUTES ----------

// POST /api/products - Create new product (admin only)
router.post('/', auth, admin, upload.single('image'), (req, res) => {
  const { name, description, price, sale_price, fabric, color, size, category, stock, is_featured } = req.body;

  if (!name || !price || !req.file) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ message: 'Name, price, and image are required' });
  }

  const imageUrl = `/uploads/${req.file.filename}`;

  db.run(
    `INSERT INTO products (name, description, price, sale_price, fabric, color, size, category, image_url, stock, is_featured)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      description || '',
      parseFloat(price),
      sale_price ? parseFloat(sale_price) : null,
      fabric || '',
      color || '',
      size || 'U (6.3 m)',
      category || 'General',
      imageUrl,
      parseInt(stock) || 10,
      is_featured ? 1 : 0
    ],
    function (err) {
      if (err) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(500).json({ message: 'Server error', error: err.message });
      }
      const newId = this.lastID;
      db.get('SELECT * FROM products WHERE id = ?', [newId], (getErr, newProduct) => {
        res.status(201).json({
          message: 'Product created successfully!',
          product: newProduct
        });
      });
    }
  );
});

// POST /api/products/:id/stock - Update stock only (admin only)
router.post('/:id/stock', auth, admin, (req, res) => {
  const id = Number(req.params.id);
  const { stock } = req.body;
  if (!id) return res.status(400).json({ message: 'Invalid product id' });
  if (stock === undefined || parseInt(stock) < 0) {
    return res.status(400).json({ message: 'Valid stock quantity is required' });
  }

  db.get('SELECT * FROM products WHERE id = ?', [id], (err, existing) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    if (!existing) return res.status(404).json({ message: 'Product not found' });

    db.run('UPDATE products SET stock = ? WHERE id = ?', [parseInt(stock), id], (updateErr) => {
      if (updateErr) return res.status(500).json({ message: 'Server error', error: updateErr.message });
      db.get('SELECT * FROM products WHERE id = ?', [id], (getErr, updated) => {
        res.json({ message: 'Stock updated!', product: updated });
      });
    });
  });
});

// PUT /api/products/:id - Update product (admin only)
router.put('/:id', auth, admin, upload.single('image'), (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid product id' });

  db.get('SELECT * FROM products WHERE id = ?', [id], (err, existing) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    if (!existing) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Product not found' });
    }

    const { name, description, price, sale_price, fabric, color, size, category, stock, is_featured } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : existing.image_url;

    db.run(
      `UPDATE products SET
         name = ?, description = ?, price = ?, sale_price = ?, fabric = ?, color = ?,
         size = ?, category = ?, image_url = ?, stock = ?, is_featured = ?
       WHERE id = ?`,
      [
        name || existing.name,
        description !== undefined ? description : existing.description,
        price !== undefined ? parseFloat(price) : existing.price,
        sale_price !== undefined && sale_price !== ''  ? parseFloat(sale_price) : null,
        fabric || existing.fabric,
        color || existing.color,
        size || existing.size,
        category || existing.category,
        imageUrl,
        stock !== undefined ? parseInt(stock) : existing.stock,
        is_featured !== undefined ? (is_featured ? 1 : 0) : existing.is_featured
      ],
      (updateErr) => {
        if (updateErr) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(500).json({ message: 'Server error', error: updateErr.message });
        }
        if (req.file) {
          const oldPath = path.join(uploadsDir, path.basename(existing.image_url));
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        db.get('SELECT * FROM products WHERE id = ?', [id], (getErr, updated) => {
          res.json({ message: 'Product updated successfully!', product: updated });
        });
      }
    );
  });
});

// DELETE /api/products/:id - Delete product (admin only)
router.delete('/:id', auth, admin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid product id' });

  db.get('SELECT * FROM products WHERE id = ?', [id], (err, existing) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    if (!existing) return res.status(404).json({ message: 'Product not found' });

    db.run('DELETE FROM products WHERE id = ?', [id], (deleteErr) => {
      if (deleteErr) return res.status(500).json({ message: 'Server error', error: deleteErr.message });

      // Remove related wishlist/reviews
      db.run('DELETE FROM wishlist WHERE product_id = ?', [id]);
      db.run('DELETE FROM reviews WHERE product_id = ?', [id]);

      const oldPath = path.join(uploadsDir, path.basename(existing.image_url));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

      res.json({ message: 'Product deleted successfully!' });
    });
  });
});

module.exports = router;