const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

dotenv.config();

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;
const useTurso = !!(TURSO_URL && TURSO_TOKEN);

/* ------------------------------------------------------------------ */
/* Shared seed data (used by both modes)                               */
/* ------------------------------------------------------------------ */
const SEED_CATEGORIES = [
  { name: 'Paithani Collection', description: 'Authentic handwoven Paithani sarees from Yeola, Maharashtra', image_url: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400' },
  { name: 'Banarasi Collection', description: 'Luxurious Banarasi silk sarees with intricate zari work', image_url: 'https://images.unsplash.com/photo-1611800066692-35d4f676d779?w=400' },
  { name: 'Kanjivaram Collection', description: 'Royal Kanjivaram silk sarees for grand occasions', image_url: 'https://images.unsplash.com/photo-1621284342245-b3d7f8b2f10a?w=400' }
];

const SEED_PRODUCTS = [
  {
    name: 'Kali Paithani Silk Saree',
    description: 'Classic black Paithani saree with exquisite golden zari and traditional peacock motif. Handwoven by master artisans in Yeola, Maharashtra.',
    price: 24999, sale_price: 19999, fabric: 'Pure Silk Paithani', color: 'Black & Gold',
    size: 'U (6.3 m)', category: 'Paithani Collection',
    image_url: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600',
    stock: 15, is_featured: 1
  },
  {
    name: 'Green Paithani Saree',
    description: 'Elegant emerald green Paithani saree with rich golden border and traditional Mogul-inspired motifs. Lightweight pure silk for grand occasions.',
    price: 18999, sale_price: null, fabric: 'Pure Silk Paithani', color: 'Emerald Green & Gold',
    size: 'U (6.3 m)', category: 'Paithani Collection',
    image_url: 'https://images.unsplash.com/photo-1611800066692-35d4f676d779?w=600',
    stock: 20, is_featured: 0
  },
  {
    name: 'Red Bridal Paithani Saree',
    description: 'Stunning deep red Paithani saree with authentic gold zari pallu and peacock ornamentation. The perfect choice for weddings and festivals.',
    price: 34999, sale_price: 27999, fabric: 'Pure Silk Paithani', color: 'Deep Red & Gold',
    size: 'U (6.3 m)', category: 'Paithani Collection',
    image_url: 'https://images.unsplash.com/photo-1621284342245-b3d7f8b2f10a?w=600',
    stock: 10, is_featured: 1
  },
  {
    name: 'Banarasi Silk Saree',
    description: 'Handwoven Banarasi silk saree with intricate gold zari and exquisite brocade work. A timeless wedding classic.',
    price: 32999, sale_price: 29999, fabric: 'Pure Silk Banarasi', color: 'Maroon & Gold',
    size: 'U (6.3 m)', category: 'Banarasi Collection',
    image_url: 'https://images.unsplash.com/photo-1605080717378-21f427417f23?w=600',
    stock: 8, is_featured: 0
  }
];

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL CHECK (price >= 0),
    sale_price REAL CHECK (sale_price IS NULL OR (sale_price >= 0 AND sale_price < price)),
    fabric TEXT,
    color TEXT,
    size TEXT,
    category TEXT,
    image_url TEXT NOT NULL,
    images TEXT,
    stock INTEGER DEFAULT 10 CHECK (stock >= 0),
    is_featured INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    items TEXT NOT NULL,
    total REAL NOT NULL,
    shipping_address TEXT,
    phone TEXT,
    status TEXT DEFAULT 'pending',
    payment_status TEXT DEFAULT 'pending',
    payment_method TEXT DEFAULT 'cod',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`,
  `CREATE TABLE IF NOT EXISTS wishlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id),
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (product_id) REFERENCES products (id)
  )`,
  `CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title TEXT,
    comment TEXT,
    photos TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, user_id),
    FOREIGN KEY (product_id) REFERENCES products (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`,
  `CREATE TABLE IF NOT EXISTS addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    country TEXT DEFAULT 'India',
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    method TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    transaction_id TEXT,
    payment_details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`,
  `CREATE TABLE IF NOT EXISTS order_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    note TEXT,
    location TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders (id)
  )`,
  `CREATE TABLE IF NOT EXISTS token_blacklist (
    jti TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL
  )`,
  // Normalized order line-items. The orders.items JSON column is kept for
  // backward-compat display, but every aggregation/report reads this table.
  `CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 1),
    price REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products (id)
  )`,
  // Discount coupons (code → percentage/amount off, optional minimum order).
  `CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'flat')),
    discount_value REAL NOT NULL CHECK (discount_value > 0),
    min_order_amount REAL DEFAULT 0,
    max_discount_amount REAL,
    active INTEGER DEFAULT 1,
    usage_limit INTEGER,
    used_count INTEGER DEFAULT 0,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  // One-time password-reset tokens (expire, single-use).
  `CREATE TABLE IF NOT EXISTS reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  // ── Indexes — turn the full-table scans behind every filter/subquery into
  //    index lookups. Idempotent (IF NOT EXISTS), so they're safe on existing DBs.
  `CREATE INDEX IF NOT EXISTS idx_products_category ON products (category)`,
  `CREATE INDEX IF NOT EXISTS idx_products_fabric ON products (fabric)`,
  `CREATE INDEX IF NOT EXISTS idx_products_color ON products (color)`,
  `CREATE INDEX IF NOT EXISTS idx_products_featured ON products (is_featured)`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews (product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_user ON orders (user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status)`,
  `CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist (user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_wishlist_product ON wishlist (product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses (user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_order ON payments (order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tracking_order ON order_tracking (order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_blacklist_expires ON token_blacklist (expires_at)`,
  // Order-by-columns used by every paginated list (turns full sorts into index scans)
  `CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_products_created ON products (created_at)`,
  // order_items lookups for admin reports + the review purchase check
  `CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items (product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_order_items_user_order ON orders (user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons (code)`,
  `CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON reset_tokens (token_hash)`
];

// Full-text search table for product name/description/category. FTS5 replaces
// the LIKE '%…%' scan on search and is orders of magnitude faster. The content
// table is external so rows stay in sync with products.
const FTS_SCHEMA = `
  CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
    name, description, category,
    content='products',
    content_rowid='id',
    tokenize='unicode61'
  )`;

let db = null;

/* ------------------------------------------------------------------ */
/* MODE A — Turso cloud SQLite (production, uses TURSO_* env vars)     */
/* ------------------------------------------------------------------ */
if (useTurso) {
  const { createClient } = require('@libsql/client');
  const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  const execute = async (sql, args = []) => {
    const res = await client.execute({ sql, args, rowMode: 'object' });
    return res;
  };

  // Callback-compatible wrapper (matches sqlite3's db.all/get/run)
  db = {
    all(sql, params, cb) {
      if (typeof params === 'function') { cb = params; params = []; }
      execute(sql, params)
        .then((res) => cb(null, res.rows || []))
        .catch((err) => cb(err));
    },
    get(sql, params, cb) {
      if (typeof params === 'function') { cb = params; params = []; }
      execute(sql, params)
        .then((res) => cb(null, (res.rows || [])[0]))
        .catch((err) => cb(err));
    },
    run(sql, params, cb) {
      if (typeof params === 'function') { cb = params; params = []; }
      execute(sql, params)
        .then((res) => {
          const ctx = { lastID: Number(res.lastInsertRowid || 0), changes: Number(res.rowsAffected || 0) };
          if (cb) cb.call(ctx, null);
        })
        .catch((err) => {
          if (cb) cb(err);
          else console.error('DB run error:', err.message);
        });
    }
  };

  // Async initialization + seeding. server.js awaits db.ready before listening.
  db.ready = (async () => {
    console.log('☁️  Initializing Turso cloud database…');

    for (const sql of SCHEMA) {
      await execute(sql);
    }
    // Enable foreign keys (best-effort — pragma support varies by libsql/Turso plan)
    try {
      await execute('PRAGMA foreign_keys = ON');
    } catch (_) { /* ignore if unsupported */ }
    console.log('✅ Turso schema ready');

    // Add images column to products if missing (existing DBs) — product galleries
    try {
      const pcols = await execute('PRAGMA table_info(products)');
      if (pcols.rows && !pcols.rows.some((c) => c.name === 'images')) {
        await execute('ALTER TABLE products ADD COLUMN images TEXT');
      }
      // Denormalized rating columns (removes per-row subqueries from catalog lists)
      if (!pcols.rows.some((c) => c.name === 'avg_rating')) {
        await execute('ALTER TABLE products ADD COLUMN avg_rating REAL');
      }
      if (!pcols.rows.some((c) => c.name === 'review_count')) {
        await execute('ALTER TABLE products ADD COLUMN review_count INTEGER DEFAULT 0');
      }
    } catch (err) {
      console.error('Products images migration failed:', err.message);
    }

    // Add photos column to reviews if missing (existing DBs) — photo reviews
    try {
      const rcols = await execute('PRAGMA table_info(reviews)');
      if (rcols.rows && !rcols.rows.some((c) => c.name === 'photos')) {
        await execute('ALTER TABLE reviews ADD COLUMN photos TEXT');
      }
    } catch (err) {
      console.error('Reviews photos migration failed:', err.message);
    }

    // Full-text search index + backfill (Turso supports FTS5 via libsql)
    try {
      await execute(FTS_SCHEMA);
      await execute("INSERT INTO products_fts(products_fts) VALUES('rebuild')");
    } catch (err) {
      console.error('FTS index init failed:', err.message);
    }

    // Backfill denormalized ratings from the reviews table (existing DBs)
    try {
      await execute(
        `UPDATE products SET
           avg_rating = (SELECT AVG(rating) FROM reviews r WHERE r.product_id = products.id),
           review_count = (SELECT COUNT(*) FROM reviews r WHERE r.product_id = products.id)`
      );
    } catch (err) {
      console.error('Ratings backfill failed:', err.message);
    }

    // Seed admin (email/password are env-configurable; the password is force-changed on first login)
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@sarees.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminRes = await execute('SELECT id FROM users WHERE email = ?', [adminEmail]);
    if (adminRes.rows.length === 0) {
      const passwordHash = bcrypt.hashSync(adminPassword, 10);
      await execute(
        'INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, 1)',
        ['Admin', adminEmail, passwordHash]
      );
      console.log(`👑 Admin user created (${adminEmail}). Change the password on first login.`);
    }

    // Seed categories
    const catRes = await execute('SELECT COUNT(*) as count FROM categories');
    if (Number(catRes.rows[0].count) === 0) {
      for (const c of SEED_CATEGORIES) {
        await execute('INSERT INTO categories (name, description, image_url) VALUES (?, ?, ?)', [c.name, c.description, c.image_url]);
      }
      console.log('🏷️ Seeded sample categories');
    }

    // Seed a starter coupon so the checkout coupon box has something to try
    try {
      const coupRes = await execute('SELECT COUNT(*) as count FROM coupons');
      if (Number(coupRes.rows[0].count) === 0) {
        await execute(
          `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, expires_at, active)
           VALUES (?, ?, ?, ?, ?, ?, NULL, 1)`,
          ['WELCOME10', 'percent', 10, 999, 500, 500]
        );
        console.log('🎟️ Seeded WELCOME10 coupon (10% off, max ₹500)');
      }
    } catch (err) {
      console.error('Coupon seed failed:', err.message);
    }

    // Seed products
    const prodRes = await execute('SELECT COUNT(*) as count FROM products');
    if (Number(prodRes.rows[0].count) === 0) {
      for (const p of SEED_PRODUCTS) {
        await execute(
          `INSERT INTO products (name, description, price, sale_price, fabric, color, size, category, image_url, stock, is_featured)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [p.name, p.description, p.price, p.sale_price, p.fabric, p.color, p.size, p.category, p.image_url, p.stock, p.is_featured]
        );
      }
      console.log('🌾 Seeded sample sarees');
    }

    // Backfill images for any single-image products (existing DBs and fresh seeds)
    try {
      const missing = await execute("SELECT id, image_url FROM products WHERE images IS NULL OR images = ''");
      for (const row of missing.rows || []) {
        await execute('UPDATE products SET images = ? WHERE id = ?', [JSON.stringify([row.image_url]), row.id]);
      }
    } catch (err) {
      console.error('Products images backfill failed:', err.message);
    }

    // Backfill order_items from orders.items JSON column (existing DBs)
    try {
      const orphans = await execute("SELECT id, items FROM orders WHERE id NOT IN (SELECT DISTINCT order_id FROM order_items)");
      for (const row of orphans.rows || []) {
        const items = JSON.parse(row.items || '[]');
        for (const item of items) {
          await execute(
            'INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)',
            [row.order_id || row.id, item.id, item.name || '', item.quantity || 1, item.price || 0]
          );
        }
      }
    } catch (err) {
      console.error('Order items backfill failed:', err.message);
    }

    console.log('🚀 Turso database ready (free tier: data persists forever)');
  })().catch((err) => {
    console.error('❌ Turso initialization failed:', err.message);
    process.exit(1);
  });
}

/* ------------------------------------------------------------------ */
/* MODE B — Local sqlite3 (development, no env vars needed)            */
/* ------------------------------------------------------------------ */
else {
  const sqlite3 = require('sqlite3').verbose();

  // DATABASE_PATH lets you place the SQLite file on a persistent disk in production
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'sarees.db');
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ Database connection error:', err.message);
      process.exit(1);
    }
    console.log('✅ Connected to local SQLite database');
  });

  // Safety net: fire-and-forget db.run() errors crash Node in sqlite3 mode if no listener exists.
  db.on('error', (err) => {
    console.error('⚠️ Unhandled SQLite error (non-fatal):', err.message);
  });

  // Await schema + seeds before the server starts listening — fixes the startup race
  // where a request arriving in the first milliseconds hit "no such table".
  db.ready = (async () => {
    // Create schema + run migrations
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        // Enforce foreign keys (wishlist/reviews/payments integrity)
        db.run('PRAGMA foreign_keys = ON');
        for (const sql of SCHEMA) {
          db.run(sql);
        }
      });

      // Add payment_status / payment_method / updated_at columns to orders if missing (existing DBs)
      db.all('PRAGMA table_info(orders)', (err, columns) => {
        if (err) return reject(err);
        const alters = [];
        if (columns && !columns.some((c) => c.name === 'payment_status')) {
          alters.push(new Promise((r) => db.run(`ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'pending'`, r)));
        }
        if (columns && !columns.some((c) => c.name === 'payment_method')) {
          alters.push(new Promise((r) => db.run(`ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'cod'`, r)));
        }
        if (columns && !columns.some((c) => c.name === 'updated_at')) {
          alters.push(new Promise((r) => db.run(`ALTER TABLE orders ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`, r)));
        }
        Promise.all(alters).then(resolve).catch(reject);
      });
    });

    // Add images column to products if missing (existing DBs) — product galleries
    await new Promise((resolve, reject) => {
      db.all('PRAGMA table_info(products)', (err, columns) => {
        if (err) return reject(err);
        const alters = [];
        if (columns && !columns.some((c) => c.name === 'images')) {
          alters.push(new Promise((r) => db.run('ALTER TABLE products ADD COLUMN images TEXT', (e) => (e ? r(e) : r()))));
        }
        if (columns && !columns.some((c) => c.name === 'avg_rating')) {
          alters.push(new Promise((r) => db.run('ALTER TABLE products ADD COLUMN avg_rating REAL', (e) => (e ? r(e) : r()))));
        }
        if (columns && !columns.some((c) => c.name === 'review_count')) {
          alters.push(new Promise((r) => db.run('ALTER TABLE products ADD COLUMN review_count INTEGER DEFAULT 0', (e) => (e ? r(e) : r()))));
        }
        Promise.all(alters).then(resolve).catch(reject);
      });
    });

    // Add photos column to reviews if missing (existing DBs) — photo reviews
    await new Promise((resolve) => {
      db.all('PRAGMA table_info(reviews)', (err, columns) => {
        if (err || (columns && columns.some((c) => c.name === 'photos'))) return resolve();
        db.run('ALTER TABLE reviews ADD COLUMN photos TEXT', () => resolve());
      });
    });

    // Full-text search index (SQLite3 supports FTS5 when compiled with it)
    await new Promise((resolve) => {
      db.run(FTS_SCHEMA, () => {
        // Rebuild FTS content from the products table
        db.run("INSERT INTO products_fts(products_fts) VALUES('rebuild')", () => resolve());
      });
    });

    // Backfill denormalized ratings from the reviews table (existing DBs)
    await new Promise((resolve) => {
      db.run(
        `UPDATE products SET
           avg_rating = (SELECT AVG(rating) FROM reviews r WHERE r.product_id = products.id),
           review_count = (SELECT COUNT(*) FROM reviews r WHERE r.product_id = products.id)`,
        () => resolve()
      );
    });

    // Seed admin (email/password are env-configurable; the password is force-changed on first login)
    await new Promise((resolve) => {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@sarees.com';
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      db.get('SELECT id FROM users WHERE email = ?', [adminEmail], (err, row) => {
        if (err) {
          console.error('Seed admin error:', err.message);
          return resolve();
        }
        if (row) return resolve();
        const passwordHash = bcrypt.hashSync(adminPassword, 10);
        db.run(
          'INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, 1)',
          ['Admin', adminEmail, passwordHash],
          (insertErr) => {
            if (insertErr) console.error('Error seeding admin:', insertErr.message);
            else console.log(`👑 Admin user created (${adminEmail}). Change the password on first login.`);
            resolve();
          }
        );
      });
    });

    // Seed categories
    await new Promise((resolve) => {
      db.get('SELECT COUNT(*) as count FROM categories', (err, row) => {
        if (err) return resolve();
        if (row.count === 0) {
          const stmt = db.prepare('INSERT INTO categories (name, description, image_url) VALUES (?, ?, ?)');
          SEED_CATEGORIES.forEach((c) => stmt.run(c.name, c.description, c.image_url));
          stmt.finalize(() => {
            console.log('🏷️ Seeded sample categories');
            resolve();
          });
        } else {
          resolve();
        }
      });
    });

    // Seed a starter coupon so the checkout coupon box has something to try
    await new Promise((resolve) => {
      db.get('SELECT COUNT(*) as count FROM coupons', (err, row) => {
        if (err || row.count > 0) return resolve();
        db.run(
          `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, expires_at, active)
           VALUES (?, ?, ?, ?, ?, ?, NULL, 1)`,
          ['WELCOME10', 'percent', 10, 999, 500, 500],
          (insertErr) => {
            if (!insertErr) console.log('🎟️ Seeded WELCOME10 coupon (10% off, max ₹500)');
            resolve();
          }
        );
      });
    });

    // Seed products
    await new Promise((resolve) => {
      db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
        if (err) return resolve();
        if (row.count === 0) {
          const stmt = db.prepare(
            `INSERT INTO products (name, description, price, sale_price, fabric, color, size, category, image_url, stock, is_featured)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          );
          SEED_PRODUCTS.forEach((p) => {
            stmt.run(p.name, p.description, p.price, p.sale_price, p.fabric, p.color, p.size, p.category, p.image_url, p.stock, p.is_featured);
          });
          stmt.finalize(() => {
            console.log('🌾 Seeded sample sarees');
            resolve();
          });
        } else {
          resolve();
        }
      });
    });

    // Backfill images for any single-image products (existing DBs and fresh seeds)
    await new Promise((resolve, reject) => {
      db.all("SELECT id, image_url FROM products WHERE images IS NULL OR images = ''", (err, rows) => {
        if (err) return reject(err);
        const updates = (rows || []).map((row) =>
          new Promise((r) => db.run('UPDATE products SET images = ? WHERE id = ?', [JSON.stringify([row.image_url]), row.id], r))
        );
        Promise.all(updates).then(resolve).catch(reject);
      });
    });

    // Backfill order_items from the orders.items JSON column (existing DBs)
    await new Promise((resolve) => {
      db.all("SELECT id, items FROM orders WHERE id NOT IN (SELECT DISTINCT order_id FROM order_items)", (err, rows) => {
        if (err || !rows || rows.length === 0) return resolve();
        const stmt = db.prepare('INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)');
        let inserted = 0;
        const done = () => { if (++inserted === rows.length) { stmt.finalize(resolve); } };
        rows.forEach((row) => {
          try {
            const items = JSON.parse(row.items || '[]');
            if (!items.length) { done(); return; }
            items.forEach((item) => {
              stmt.run(row.order_id, item.id, item.name || '', item.quantity || 1, item.price || 0);
            });
          } catch (_) { /* skip malformed */ }
          done();
        });
      });
    });

    console.log('🚀 Local database ready');
  })().catch((err) => {
    console.error('❌ Local database initialization failed:', err.message);
    process.exit(1);
  });
}

module.exports = db;