const express = require('express');
const db = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// All routes require admin
router.use(auth, (req, res, next) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  // The seeded admin must rotate the default password before the dashboard is usable.
  if (req.user.default_password) {
    return res.status(403).json({ message: 'You must change the default admin password before using the admin panel.' });
  }
  next();
});

// GET /api/admin/stats - Dashboard statistics (single query instead of 8 separate scans)
router.get('/stats', (req, res) => {
  db.get(
    `SELECT
       COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total END), 0) as total_revenue,
       COUNT(*) as total_orders,
       (SELECT COUNT(*) FROM products) as total_products,
       (SELECT COUNT(*) FROM users WHERE is_admin = 0) as total_customers,
       (SELECT COUNT(*) FROM products WHERE stock <= 5) as low_stock,
       (SELECT COUNT(*) FROM products WHERE stock = 0) as out_of_stock,
       COUNT(CASE WHEN status IN ('pending', 'confirmed', 'processing') THEN 1 END) as pending_orders,
       COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders
     FROM orders`,
    (err, row) => {
      if (err) return res.status(500).json({ message: 'Server error' });
      res.json({ stats: row || {} });
    }
  );
});

// GET /api/admin/revenue-trend - Revenue by month (last 6 months)
router.get('/revenue-trend', (req, res) => {
  db.all(
    `SELECT strftime('%Y-%m', created_at) as month,
            COUNT(*) as orders,
            COALESCE(SUM(total), 0) as revenue
     FROM orders
     WHERE status != 'cancelled' AND created_at >= datetime('now', '-6 months')
     GROUP BY strftime('%Y-%m', created_at)
     ORDER BY month ASC`,
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Server error' });
      res.json({ trend: rows });
    }
  );
});

// GET /api/admin/top-products - Top selling products (via normalized order_items)
router.get('/top-products', (req, res) => {
  db.all(
    `SELECT p.id, p.name, p.image_url, p.price, p.stock,
            COUNT(DISTINCT oi.order_id) as orders_count,
            COALESCE(SUM(oi.quantity * oi.price), 0) as revenue
     FROM products p
     LEFT JOIN order_items oi ON oi.product_id = p.id
     LEFT JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
     GROUP BY p.id
     ORDER BY revenue DESC
     LIMIT 10`,
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Server error' });
      res.json({ products: rows });
    }
  );
});

// GET /api/admin/recent-orders - Recent orders (safe JSON parse, paginated)
router.get('/recent-orders', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const offset = (page - 1) * limit;

  db.get('SELECT COUNT(*) as count FROM orders', (countErr, countRow) => {
    if (countErr) return res.status(500).json({ message: 'Server error' });
    db.all(
      `SELECT o.*, u.name as customer_name FROM orders o
       JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset],
      (err, rows) => {
        if (err) return res.status(500).json({ message: 'Server error' });
        const orders = rows.map((o) => {
          let items = [];
          try { items = JSON.parse(o.items || '[]'); } catch (_) { items = []; }
          return { ...o, items };
        });
        res.json({ orders, total: countRow?.count || 0, page, limit });
      }
    );
  });
});

// GET /api/admin/inventory-report - Full inventory report
router.get('/inventory-report', (req, res) => {
  db.all(
    `SELECT p.id, p.name, p.category, p.price, p.stock, p.is_featured,
            p.sale_price, p.image_url, p.review_count, p.avg_rating
     FROM products p
     ORDER BY p.stock ASC`,
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Server error' });
      res.json({ products: rows });
    }
  );
});

// GET /api/admin/users - All users (customers), paginated
router.get('/users', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  db.get('SELECT COUNT(*) as count FROM users', (countErr, countRow) => {
    if (countErr) return res.status(500).json({ message: 'Server error' });
    db.all(
      `SELECT u.id, u.name, u.email, u.is_admin, u.created_at,
              (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) as order_count,
              (SELECT COALESCE(SUM(total), 0) FROM orders o WHERE o.user_id = u.id AND o.status != 'cancelled') as total_spent
       FROM users u
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset],
      (err, rows) => {
        if (err) return res.status(500).json({ message: 'Server error' });
        res.json({ users: rows, total: countRow?.count || 0, page, limit });
      }
    );
  });
});

// GET /api/admin/category-report - Category-wise sales
router.get('/category-report', (req, res) => {
  db.all(
    `SELECT category, COUNT(*) as product_count,
            COALESCE(SUM(stock), 0) as total_stock,
            COALESCE(SUM(stock * price), 0) as stock_value
     FROM products
     GROUP BY category
     ORDER BY product_count DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Server error' });
      res.json({ categories: rows });
    }
  );
});

module.exports = router;