const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const db = require('../db');
const { auth, admin } = require('../middleware/auth');

const router = express.Router();

// Cloudinary config (production: permanent CDN image hosting, free tier)
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUD_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUD_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const useCloudinary = !!(CLOUD_NAME && CLOUD_API_KEY && CLOUD_API_SECRET);

if (useCloudinary) {
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: CLOUD_API_KEY,
    api_secret: CLOUD_API_SECRET,
  });
  console.log('☁️  Cloudinary configured — product images will be stored permanently in the cloud');
}

// Ensure uploads directory exists (only used in local/dev mode now)
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const MIME_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const IMAGE_MIME = new Set(Object.keys(MIME_EXT));

// Configure multer for image uploads — memory storage so we can push to Cloudinary.
// In local mode (no Cloudinary env vars) we fall back to disk storage as before.
const storage = useCloudinary
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadsDir),
      filename: (req, file, cb) => {
        // Never trust the client filename/extension — derive a safe one from the mimetype
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = MIME_EXT[file.mimetype] || '.jpg';
        cb(null, `product-${unique}${ext}`);
      }
    });

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (IMAGE_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WEBP, GIF) are allowed'));
    }
  }
});

// Verify a local upload is a real image by its magic bytes (mimetypes are client-controlled).
const assertLocalImage = (filePath) => {
  const head = fs.readFileSync(filePath).subarray(0, 12);
  const signatures = [
    { ext: '.jpg', bytes: [0xff, 0xd8, 0xff] },
    { ext: '.png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
    { ext: '.gif', bytes: [0x47, 0x49, 0x46, 0x38] }, // "GIF8"
    { ext: '.webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // "RIFF" — WEBP containers start with RIFF....WEBP
  ];
  const ok = signatures.some((s) => s.bytes.every((b, i) => head[i] === b));
  if (!ok) throw new Error('Uploaded file is not a valid image');
};

// Remove the locally-saved files for a failed upload (no-op in Cloudinary mode)
const cleanupUploaded = (req) => {
  if (useCloudinary) return;
  const files = req.files || (req.file ? [req.file] : []);
  files.forEach((f) => {
    if (f && f.path) {
      try { fs.unlinkSync(f.path); } catch (_) { /* already gone */ }
    }
  });
};

// Upload an image buffer to Cloudinary. Returns the secure CDN URL.
// Falls back to a local file path if Cloudinary is not configured.
const uploadImage = async (file) => {
  if (useCloudinary) {
    const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const result = await cloudinary.uploader.upload(base64, {
      folder: 'saree_products',
      resource_type: 'image',
    });
    return result.secure_url;
  }
  // Local disk fallback (dev mode) — validate magic bytes before serving it publicly
  assertLocalImage(file.path);
  return `/uploads/${file.filename}`;
};

// Delete an image from Cloudinary by its URL (best-effort; ignores errors for seed/unsplash images)
const deleteImage = async (imageUrl) => {
  if (!imageUrl || !useCloudinary || !imageUrl.includes('res.cloudinary.com')) return;
  try {
    const publicId = imageUrl.split('/').slice(-2).join('/').replace(/\.[^.]+$/, '');
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Cloudinary delete warning:', err.message);
  }
};

// Local deletion helper (dev mode)
const deleteLocalImage = (imageUrl) => {
  if (!imageUrl || imageUrl.includes('http')) return;
  const oldPath = path.join(uploadsDir, path.basename(imageUrl));
  if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
};

// Parse the images JSON column into an array of URLs (legacy rows have it NULL/empty).
const parseImages = (p) => {
  if (!p) return [];
  try {
    const parsed = JSON.parse(p.images || '[]');
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (_) {
    return [];
  }
};

// Return a product row with `images` as a real array. image_url stays the primary
// (first) image, so all existing consumers (cards, cart, order items) keep working.
const formatProduct = (p) => {
  if (!p) return p;
  const images = parseImages(p);
  return { ...p, images: images.length ? images : (p.image_url ? [p.image_url] : []) };
};

// Shared: validate price / sale_price / stock values coming from an admin form.
// fallbackPrice is the existing product price (used when price isn't part of the update).
// Returns { error } or { price, sale_price, stock }.
const validatePricing = ({ price, sale_price, stock }, fallbackPrice = null) => {
  let priceNum = price === undefined || price === '' ? null : Number(price);
  if (priceNum !== null && (!Number.isFinite(priceNum) || priceNum <= 0)) {
    return { error: 'Price must be a positive number' };
  }
  const effectivePrice = priceNum !== null ? priceNum : fallbackPrice;
  let saleNum = null;
  if (sale_price !== undefined && sale_price !== '' && sale_price !== null) {
    saleNum = Number(sale_price);
    if (!Number.isFinite(saleNum) || saleNum < 0 || (effectivePrice !== null && saleNum >= effectivePrice)) {
      return { error: 'Sale price must be a non-negative number lower than the price' };
    }
  }
  let stockNum = stock === undefined || stock === '' ? null : Number(stock);
  if (stockNum !== null && (!Number.isInteger(stockNum) || stockNum < 0)) {
    return { error: 'Stock must be a non-negative whole number' };
  }
  return { price: priceNum, sale_price: saleNum, stock: stockNum };
};

// ---------- PUBLIC ROUTES ----------

// GET /api/products - List products with optional filters, search, sort, pagination
router.get('/', (req, res) => {
  const { category, fabric, color, search, sort, min_price, max_price, in_stock, featured, page = 1, limit = 50 } = req.query;

  const params = [];
  let orderBy = 'p.created_at DESC';
  let baseFrom = 'products p';

  // When a search query is present, join the FTS index for instant full-text
  // search instead of the expensive LIKE '%…%' full-table scan.
  let where = '1=1';
  if (search) {
    // FTS5 match — strip non-alphanumeric chars to avoid syntax errors
    const q = search.replace(/[^\w\s]/g, '').trim();
    if (q) {
      baseFrom = 'products p JOIN products_fts fts ON p.id = fts.rowid';
      // Rank by relevance + recency; use MATCH + BM25
      where = "fts.name MATCH ?";
      params.push(q + '*'); // prefix match
      orderBy = `rank, p.created_at DESC`;
    }
  }

  // Use exact match (=) for category/fabric/color — indexed lookups, not LIKE scans
  if (category) { where += ' AND p.category = ?'; params.push(category); }
  if (fabric) { where += ' AND p.fabric = ?'; params.push(fabric); }
  if (color) { where += ' AND p.color = ?'; params.push(color); }

  // Price filters use the effective (sale) price when present
  const minP = parseFloat(min_price);
  const maxP = parseFloat(max_price);
  if (Number.isFinite(minP) && minP > 0) { where += ' AND COALESCE(p.sale_price, p.price) >= ?'; params.push(minP); }
  if (Number.isFinite(maxP) && maxP > 0) { where += ' AND COALESCE(p.sale_price, p.price) <= ?'; params.push(maxP); }
  if (in_stock === 'true' || in_stock === '1') where += ' AND p.stock > 0';
  if (featured === 'true' || featured === '1' || sort === 'featured') where += ' AND p.is_featured = 1';

  // Sort options — use denormalized columns for rating/popularity
  if (sort === 'price_asc') orderBy = 'COALESCE(p.sale_price, p.price) ASC';
  else if (sort === 'price_desc') orderBy = 'COALESCE(p.sale_price, p.price) DESC';
  else if (sort === 'rating') orderBy = 'p.avg_rating DESC NULLS LAST, p.review_count DESC';
  else if (sort === 'popularity') orderBy = 'p.review_count DESC, p.created_at DESC';

  const limitNum = Math.min(Math.max(1, Number(limit) || 50), 100);
  const pageNum = Math.max(1, Number(page) || 1);
  const offset = (pageNum - 1) * limitNum;

  const whereSql = where;
  const selectSql = `SELECT p.*
    FROM ${baseFrom} WHERE ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;

  db.all(selectSql, [...params, limitNum, offset], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    const products = rows.map((p) => formatProduct({
      ...p,
      avg_rating: p.avg_rating ? Number(p.avg_rating).toFixed(1) : null,
      review_count: p.review_count || 0
    }));

    db.get(`SELECT COUNT(*) as total FROM ${baseFrom} WHERE ${whereSql}`, params, (cErr, countRow) => {
      if (cErr) return res.status(500).json({ message: 'Server error' });
      res.json({ products, total: countRow?.total || 0, page: pageNum, limit: limitNum });
    });
  });
});

// GET /api/products/featured - Get featured products
router.get('/featured', (req, res) => {
  db.all(
    `SELECT p.*
     FROM products p WHERE p.is_featured = 1 AND p.stock > 0 ORDER BY p.created_at DESC LIMIT 8`,
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Server error' });
      const products = rows.map((p) => formatProduct({ ...p, avg_rating: p.avg_rating ? Number(p.avg_rating).toFixed(1) : null, review_count: p.review_count || 0 }));
      res.json({ products });
    }
  );
});

// GET /api/products/related/:id - Related products by category
router.get('/related/:id', (req, res) => {
  const id = Number(req.params.id);
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    db.all(
      `SELECT p.*
       FROM products p WHERE p.category = ? AND p.id != ? AND p.stock > 0 ORDER BY p.review_count DESC LIMIT 4`,
      [product.category, id],
      (relatedErr, rows) => {
        if (relatedErr) return res.status(500).json({ message: 'Server error' });
        const products = rows.map((p) => formatProduct({ ...p, avg_rating: p.avg_rating ? Number(p.avg_rating).toFixed(1) : null, review_count: p.review_count || 0 }));
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
    `SELECT p.*
     FROM products p WHERE p.id = ?`,
    [id],
    (err, row) => {
      if (err) return res.status(500).json({ message: 'Server error' });
      if (!row) return res.status(404).json({ message: 'Product not found' });
      res.json({ product: formatProduct({ ...row, avg_rating: row.avg_rating ? Number(row.avg_rating).toFixed(1) : null, review_count: row.review_count || 0 }) });
    }
  );
});

// ---------- ADMIN ROUTES ----------

// POST /api/products - Create new product (admin only). Accepts 1-5 images.
router.post('/', auth, admin, upload.array('images', 5), async (req, res) => {
  const { name, description, price, sale_price, fabric, color, size, category, stock, is_featured } = req.body;

  if (!name || !String(name).trim()) {
    cleanupUploaded(req);
    return res.status(400).json({ message: 'Product name is required' });
  }
  if (!price || !req.files || req.files.length === 0) {
    cleanupUploaded(req);
    return res.status(400).json({ message: 'Name, price, and at least one image are required' });
  }

  const pricing = validatePricing({ price, sale_price, stock });
  if (pricing.error) {
    cleanupUploaded(req);
    return res.status(400).json({ message: pricing.error });
  }

  try {
    const urls = await Promise.all(req.files.map(uploadImage));
    const imageUrl = urls[0];
    const images = JSON.stringify(urls);

    db.run(
      `INSERT INTO products (name, description, price, sale_price, fabric, color, size, category, image_url, images, stock, is_featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(name).trim(),
        description || '',
        pricing.price,
        pricing.sale_price,
        fabric || '',
        color || '',
        size || 'U (6.3 m)',
        category || 'General',
        imageUrl,
        images,
        pricing.stock === null ? 10 : pricing.stock,
        is_featured ? 1 : 0
      ],
      function (err) {
        if (err) {
          cleanupUploaded(req);
          return res.status(500).json({ message: 'Server error' });
        }
        const newId = this.lastID;
        db.get('SELECT * FROM products WHERE id = ?', [newId], (getErr, newProduct) => {
          // Rebuild FTS so the new product is searchable
          db.run("INSERT INTO products_fts(products_fts) VALUES('rebuild')", () => {});

          res.status(201).json({ message: 'Product created successfully!', product: formatProduct(newProduct) });
        });
      }
    );
  } catch (err) {
    console.error('Image upload failed:', err.message);
    cleanupUploaded(req);
    res.status(400).json({ message: 'Image upload failed. Please try a valid image.' });
  }
});

// POST /api/products/:id/stock - Update stock only (admin only)
router.post('/:id/stock', auth, admin, (req, res) => {
  const id = Number(req.params.id);
  const { stock } = req.body;
  if (!id) return res.status(400).json({ message: 'Invalid product id' });

  const stockNum = stock === undefined || stock === '' ? NaN : Number(stock);
  if (!Number.isInteger(stockNum) || stockNum < 0) {
    return res.status(400).json({ message: 'Stock must be a non-negative whole number' });
  }

  db.get('SELECT * FROM products WHERE id = ?', [id], (err, existing) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!existing) return res.status(404).json({ message: 'Product not found' });

    db.run('UPDATE products SET stock = ? WHERE id = ?', [stockNum, id], (updateErr) => {
      if (updateErr) return res.status(500).json({ message: 'Server error' });
      db.get('SELECT * FROM products WHERE id = ?', [id], (getErr, updated) => {
        res.json({ message: 'Stock updated!', product: updated });
      });
    });
  });
});

// PUT /api/products/:id - Update product (admin only)
router.put('/:id', auth, admin, upload.array('images', 5), async (req, res) => {
  const id = Number(req.params.id);
  if (!id) {
    cleanupUploaded(req);
    return res.status(400).json({ message: 'Invalid product id' });
  }

  const { name, description, price, sale_price, fabric, color, size, category, stock, is_featured } = req.body;

  db.get('SELECT * FROM products WHERE id = ?', [id], async (err, existing) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!existing) {
      cleanupUploaded(req);
      return res.status(404).json({ message: 'Product not found' });
    }

    const pricing = validatePricing({ price, sale_price, stock }, existing.price);
    if (pricing.error) {
      cleanupUploaded(req);
      return res.status(400).json({ message: pricing.error });
    }

    try {
      // If new images were uploaded, upload them all and replace the gallery.
      // Otherwise keep the existing image_url + images untouched.
      const oldImages = new Set(parseImages(existing));
      if (existing.image_url) oldImages.add(existing.image_url);
      let newImageUrl = existing.image_url;
      let newImages = existing.images;
      if (req.files && req.files.length > 0) {
        const urls = await Promise.all(req.files.map(uploadImage));
        newImageUrl = urls[0];
        newImages = JSON.stringify(urls);
        oldImages.forEach(deleteImage);
        oldImages.forEach(deleteLocalImage);
      }

      db.run(
        `UPDATE products SET
           name = ?, description = ?, price = ?, sale_price = ?, fabric = ?, color = ?,
           size = ?, category = ?, image_url = ?, images = ?, stock = ?, is_featured = ?
         WHERE id = ?`,
        [
          name !== undefined && name !== '' ? String(name).trim() : existing.name,
          description !== undefined ? description : existing.description,
          pricing.price !== null ? pricing.price : existing.price,
          pricing.sale_price !== null ? pricing.sale_price : null,
          fabric || existing.fabric,
          color || existing.color,
          size || existing.size,
          category || existing.category,
          newImageUrl,
          newImages,
          pricing.stock !== null ? pricing.stock : existing.stock,
          is_featured !== undefined ? (is_featured ? 1 : 0) : existing.is_featured,
          id
        ],
        (updateErr) => {
          if (updateErr) {
            cleanupUploaded(req);
            return res.status(500).json({ message: 'Server error' });
          }
          db.get('SELECT * FROM products WHERE id = ?', [id], (getErr, updated) => {
            // Rebuild FTS so the product changes are searchable
            db.run("INSERT INTO products_fts(products_fts) VALUES('rebuild')", () => {});
            res.json({ message: 'Product updated successfully!', product: formatProduct(updated) });
          });
        }
      );
    } catch (uploadErr) {
      console.error('Image upload failed:', uploadErr.message);
      cleanupUploaded(req);
      res.status(400).json({ message: uploadErr.message || 'Image upload failed' });
    }
  });
});

// DELETE /api/products/:id - Delete product (admin only)
router.delete('/:id', auth, admin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid product id' });

  db.get('SELECT * FROM products WHERE id = ?', [id], (err, existing) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!existing) return res.status(404).json({ message: 'Product not found' });

    db.run('DELETE FROM products WHERE id = ?', [id], (deleteErr) => {
      if (deleteErr) return res.status(500).json({ message: 'Server error' });

      // Remove related wishlist/reviews (with callbacks so failures are logged, not fatal)
      db.run('DELETE FROM wishlist WHERE product_id = ?', [id], (e1) => {
        if (e1) console.error('Wishlist cleanup error:', e1.message);
      });
      db.run('DELETE FROM reviews WHERE product_id = ?', [id], (e2) => {
        if (e2) console.error('Review cleanup error:', e2.message);
      });

      // Remove all gallery images from cloud/local storage
      const gallery = new Set(parseImages(existing));
      if (existing.image_url) gallery.add(existing.image_url);
      gallery.forEach(deleteImage);
      gallery.forEach(deleteLocalImage);

      // Rebuild FTS so the product disappears from search
      db.run("INSERT INTO products_fts(products_fts) VALUES('rebuild')", () => {});
      res.json({ message: 'Product deleted successfully!' });
    });
  });
});

module.exports = router;
