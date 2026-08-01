const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// DATABASE_PATH lets you place the SQLite file on a persistent disk in production
// (e.g. Render free persistent disk at /var/data/sarees.db).
// Defaults to ./sarees.db locally.
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'sarees.db');

// Ensure the parent directory exists (important for persistent disks like Render)
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

// Initialize database schema
db.serialize(() => {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Products table
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      sale_price REAL,
      fabric TEXT,
      color TEXT,
      size TEXT,
      category TEXT,
      image_url TEXT NOT NULL,
      stock INTEGER DEFAULT 10,
      is_featured INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Orders table
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      items TEXT NOT NULL,          -- JSON string of cart items
      total REAL NOT NULL,
      shipping_address TEXT,
      phone TEXT,
      status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'pending',
      payment_method TEXT DEFAULT 'cod',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Wishlist table
  db.run(`
    CREATE TABLE IF NOT EXISTS wishlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id),
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (product_id) REFERENCES products (id)
    )
  `);

  // Reviews table
  db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
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
    )
  `);

  // Addresses table
  db.run(`
    CREATE TABLE IF NOT EXISTS addresses (
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
    )
  `);

  // Payments table
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
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
    )
  `);

  // Order tracking table
  db.run(`
    CREATE TABLE IF NOT EXISTS order_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      note TEXT,
      location TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders (id)
    )
  `);

  // Categories table
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add updated_at column to orders if missing (for existing DBs)
  db.all(`PRAGMA table_info(orders)`, (err, columns) => {
    if (!err && columns && !columns.some((c) => c.name === 'payment_status')) {
      db.run(`ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'pending'`);
    }
    if (!err && columns && !columns.some((c) => c.name === 'payment_method')) {
      db.run(`ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'cod'`);
    }
    if (!err && columns && !columns.some((c) => c.name === 'updated_at')) {
      db.run(`ALTER TABLE orders ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
    }
  });
});

// Seed admin user if it doesn't exist
const seedAdmin = () => {
  const email = 'admin@sarees.com';
  db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
    if (err) {
      console.error('Seed admin error:', err.message);
      return;
    }
    if (!row) {
      const passwordHash = bcrypt.hashSync('admin123', 10);
      db.run(
        'INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, 1)',
        ['Admin', email, passwordHash],
        (insertErr) => {
          if (insertErr) {
            console.error('Error seeding admin:', insertErr.message);
          } else {
            console.log('👑 Admin user created: admin@sarees.com / admin123');
          }
        }
      );
    }
  });
};

// Seed sample categories if categories table is empty
const seedCategories = () => {
  db.get('SELECT COUNT(*) as count FROM categories', (err, row) => {
    if (err) return;
    if (row.count === 0) {
      const categories = [
        { name: 'Paithani Collection', description: 'Authentic handwoven Paithani sarees from Yeola, Maharashtra', image_url: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400' },
        { name: 'Banarasi Collection', description: 'Luxurious Banarasi silk sarees with intricate zari work', image_url: 'https://images.unsplash.com/photo-1611800066692-35d4f676d779?w=400' },
        { name: 'Kanjivaram Collection', description: 'Royal Kanjivaram silk sarees for grand occasions', image_url: 'https://images.unsplash.com/photo-1621284342245-b3d7f8b2f10a?w=400' }
      ];
      const stmt = db.prepare('INSERT INTO categories (name, description, image_url) VALUES (?, ?, ?)');
      categories.forEach((c) => stmt.run(c.name, c.description, c.image_url));
      stmt.finalize();
      console.log('🏷️ Seeded sample categories');
    }
  });
};

// Seed a few sample sarees if products table is empty
const seedProducts = () => {
  db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
    if (err) return;
    if (row.count === 0) {
      const samples = [
        {
          name: 'Kali Paithani Silk Saree',
          description: 'Classic black Paithani saree with exquisite golden zari and traditional peacock motif. Handwoven by master artisans in Yeola, Maharashtra.',
          price: 24999,
          sale_price: 19999,
          fabric: 'Pure Silk Paithani',
          color: 'Black & Gold',
          size: 'U (6.3 m)',
          category: 'Paithani Collection',
          image_url: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600',
          stock: 15,
          is_featured: 1
        },
        {
          name: 'Green Paithani Saree',
          description: 'Elegant emerald green Paithani saree with rich golden border and traditional Mogul-inspired motifs. Lightweight pure silk for grand occasions.',
          price: 18999,
          sale_price: null,
          fabric: 'Pure Silk Paithani',
          color: 'Emerald Green & Gold',
          size: 'U (6.3 m)',
          category: 'Paithani Collection',
          image_url: 'https://images.unsplash.com/photo-1611800066692-35d4f676d779?w=600',
          stock: 20,
          is_featured: 0
        },
        {
          name: 'Red Bridal Paithani Saree',
          description: 'Stunning deep red Paithani saree with authentic gold zari pallu and peacock ornamentation. The perfect choice for weddings and festivals.',
          price: 34999,
          sale_price: 27999,
          fabric: 'Pure Silk Paithani',
          color: 'Deep Red & Gold',
          size: 'U (6.3 m)',
          category: 'Paithani Collection',
          image_url: 'https://images.unsplash.com/photo-1621284342245-b3d7f8b2f10a?w=600',
          stock: 10,
          is_featured: 1
        },
        {
          name: 'Banarasi Silk Saree',
          description: 'Handwoven Banarasi silk saree with intricate gold zari and exquisite brocade work. A timeless wedding classic.',
          price: 32999,
          sale_price: 29999,
          fabric: 'Pure Silk Banarasi',
          color: 'Maroon & Gold',
          size: 'U (6.3 m)',
          category: 'Banarasi Collection',
          image_url: 'https://images.unsplash.com/photo-1605080717378-21f427417f23?w=600',
          stock: 8,
          is_featured: 0
        }
      ];
      const stmt = db.prepare(`
        INSERT INTO products (name, description, price, sale_price, fabric, color, size, category, image_url, stock, is_featured)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      samples.forEach((p) => {
        stmt.run(p.name, p.description, p.price, p.sale_price, p.fabric, p.color, p.size, p.category, p.image_url, p.stock, p.is_featured);
      });
      stmt.finalize();
      console.log('🌾 Seeded sample sarees');
    }
  });
};

seedAdmin();
seedCategories();
seedProducts();

module.exports = db;