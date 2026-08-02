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
  `CREATE INDEX IF NOT EXISTS idx_tracking_order ON order_tracking (order_id)`
];

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

    // Seed admin
    const adminRes = await execute('SELECT id FROM users WHERE email = ?', ['admin@sarees.com']);
    if (adminRes.rows.length === 0) {
      const passwordHash = bcrypt.hashSync('admin123', 10);
      await execute(
        'INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, 1)',
        ['Admin', 'admin@sarees.com', passwordHash]
      );
      console.log('👑 Admin user created: admin@sarees.com / admin123');
    }

    // Seed categories
    const catRes = await execute('SELECT COUNT(*) as count FROM categories');
    if (Number(catRes.rows[0].count) === 0) {
      for (const c of SEED_CATEGORIES) {
        await execute('INSERT INTO categories (name, description, image_url) VALUES (?, ?, ?)', [c.name, c.description, c.image_url]);
      }
      console.log('🏷️ Seeded sample categories');
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

    // Seed admin
    await new Promise((resolve) => {
      db.get('SELECT id FROM users WHERE email = ?', ['admin@sarees.com'], (err, row) => {
        if (err) {
          console.error('Seed admin error:', err.message);
          return resolve();
        }
        if (row) return resolve();
        const passwordHash = bcrypt.hashSync('admin123', 10);
        db.run(
          'INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, 1)',
          ['Admin', 'admin@sarees.com', passwordHash],
          (insertErr) => {
            if (insertErr) console.error('Error seeding admin:', insertErr.message);
            else console.log('👑 Admin user created: admin@sarees.com / admin123');
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

    console.log('🚀 Local database ready');
  })().catch((err) => {
    console.error('❌ Local database initialization failed:', err.message);
    process.exit(1);
  });
}

module.exports = db;